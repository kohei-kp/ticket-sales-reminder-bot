import { MessageAPIResponseBase, TextMessage, WebhookEvent } from '@line/bot-sdk'
import { Hono } from 'hono'

export type Env = {
  LINE_CHANNEL_ACCESS_TOKEN: string
  DB: D1Database
}

export type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

//app.get('*', (c) => c.text('Hello World'))

app.post('/api/webhook', async (c) => {
  const data = await c.req.json()
  const events: WebhookEvent[] = data.events
  const env = c.env as Env
  const accessToken = env.LINE_CHANNEL_ACCESS_TOKEN

  await Promise.all(
    events.map(async (event) => {
      try {
        await textEventHandler(event, accessToken, c.env.DB)
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
  const { text } = event.message
  const response: TextMessage = {
    type: 'text',
    text,
  }
  // 今日のチケ発 というメッセージが来たら、D1から一覧を取得して返信する
  if (event.message.text.includes('チケ発')) {
    const query = `SELECT * FROM sales WHERE DATE(ticket_sales_date) = DATE('now');`
    try {
      let { results } = await db.prepare(query).all()
      let messages = results.map((result: any) => {
        return {
          type: 'text',
          text: `${result.event_name} ${result.ticket_sales_date}\n${result.event_url}`,
        }
      })
      console.log(messages)

      if (messages.length === 0) {
        messages = [
          {
            type: 'text',
            text: '本日のチケット発売はありません',
          },
        ]
      }

      await fetch('https://api.line.me/v2/bot/message/reply', {
        body: JSON.stringify({
          replyToken,
          messages,
        }),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err)
      }
    }
  }
}

async function scheduled(event: any, env: any, ctx: any) {
  console.log('scheduled', event, ctx)

  const accessToken = env.LINE_CHANNEL_ACCESS_TOKEN
  const db = env.DB

  // 1時間以内にチケット発売のイベントを通知する
  const query = `SELECT * FROM sales WHERE ticket_sales_date BETWEEN datetime('now', '+9 hour') AND datetime('now', '+10 hour');`

  try {
    let { results } = await db.prepare(query).all()
    const messages = results.map(
      (result: any) => `${result.event_name} ${result.ticket_sales_date}\n${result.event_url}`
    )
    const message = '1時間以内にチケ発！！！\n' + messages.join('\n----------------------\n')

    if (messages.length === 0) {
      return
    }

    await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages: [
          {
            type: 'text',
            text: message,
          },
        ],
      }),
    })
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
