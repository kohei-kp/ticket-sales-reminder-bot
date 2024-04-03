import { MessageAPIResponseBase, TextMessage, WebhookEvent } from '@line/bot-sdk'
import Line from './line'
import { Hono } from 'hono'

export type Env = {
  LINE_CHANNEL_ACCESS_TOKEN: string
  DB: D1Database
}

export type Bindings = {
  DB: D1Database
}

const app = new Hono()

//app.get('*', (c) => c.text('Hello World'))

app.post('/api/webhook', async (c) => {
  const data = await c.req.json()
  const events: WebhookEvent[] = data.events
  const env = c.env as Env
  const accessToken = env.LINE_CHANNEL_ACCESS_TOKEN

  await Promise.all(
    events.map(async (event) => {
      try {
        await textEventHandler(event, accessToken, env.DB)
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.error(err)
        }

        return c.json({ status: 'error' })
      }
    })
  )

  return c.json({ message: 'success' })
})

async function textEventHandler(
  event: WebhookEvent,
  accessToken: string,
  db: D1Database
): Promise<MessageAPIResponseBase | undefined> {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return
  }

  const { replyToken } = event
  const text = event.message.text

  // 今日のチケ発 というメッセージが来たら、D1から一覧を取得して返信する
  if (text.includes('チケ発')) {
    const query = `SELECT * FROM sales WHERE DATE(ticket_sales_date) = DATE('now', '+9 hour');`
    try {
      let { results } = await db.prepare(query).all()
      let adjustMessages: string[] = results.map((result: any) => {
        return `${result.event_name} ${result.ticket_sales_date}\n${result.event_url}`
      })

      let messages: TextMessage[] = [
        {
          type: 'text',
          text: adjustMessages.join('\n-------------------------------\n'),
        },
      ]

      if (adjustMessages.length === 0) {
        messages = [
          {
            type: 'text',
            text: '本日のチケット発売はありません',
          },
        ]
      }

      const line = new Line(accessToken)
      await line.reply(replyToken, messages)
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err)
      }
    }
  } else if (text.includes('追加')) {
    const messages: TextMessage[] = [
      {
        type: 'text',
        text: `登録するイベントの情報を以下の形式で入力してください：\n
[イベント名]
[イベントURL]
[発売日時]
\n
例:
イベント名
https://example.com/concert
2024-04-01 22:00`,
      },
    ]
    const line = new Line(accessToken)
    await line.reply(replyToken, messages)
  } else {
    // ユーザーからの入力を受け取ってDBに追加
    const [eventName, eventUrl, salesDate] = text.split('\n')
    console.log(eventName, eventUrl, salesDate)

    if (!eventName || !eventUrl || !salesDate) {
      const messages: TextMessage[] = [
        {
          type: 'text',
          text: '入力が不足しています',
        },
      ]
      const line = new Line(accessToken)
      await line.reply(replyToken, messages)
      return
    }
    if (salesDate.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/) === null) {
      const messages: TextMessage[] = [
        {
          type: 'text',
          text: '日付はYYYY-MM-DD HH:MMの形式で入力してください',
        },
      ]
      const line = new Line(accessToken)
      await line.reply(replyToken, messages)
      return
    }

    const query = `INSERT INTO sales (event_name, event_url, ticket_sales_date) VALUES (?, ?, ?);`
    try {
      await db.prepare(query).bind(eventName, eventUrl, salesDate).run()
      const messages: TextMessage[] = [
        {
          type: 'text',
          text: 'イベントを追加しました',
        },
      ]

      const line = new Line(accessToken)
      await line.reply(replyToken, messages)
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err)
      }
    }
  }
}

/**
 * スケジュール実行される関数
 */
async function scheduled(event: any, env: any, ctx: any) {
  const accessToken = env.LINE_CHANNEL_ACCESS_TOKEN
  const db = env.DB

  // 1時間以内にチケット発売のイベントを通知する
  const query = `SELECT * FROM sales WHERE ticket_sales_date BETWEEN datetime('now', '+9 hour') AND datetime('now', '+10 hour');`

  try {
    let { results } = await db.prepare(query).all()
    if (results.length === 0) {
      return
    }

    const adjustMessages = results.map(
      (result: any) => `${result.event_name} ${result.ticket_sales_date}\n${result.event_url}`
    )
    const message =
      '1時間以内にチケ発！！！\n' + adjustMessages.join('\n-------------------------------\n')

    const messages: TextMessage[] = [
      {
        type: 'text',
        text: message,
      },
    ]

    const line = new Line(accessToken)
    await line.broadcast(messages)
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(err)
    }
  }
}

export default {
  fetch: app.fetch,
  scheduled,
}
