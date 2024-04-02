import { TextMessage } from '@line/bot-sdk'

export default class Line {
  baseUrl: string = 'https://api.line.me/v2/bot/message'
  accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  /**
   * replay
   */
  async reply(replyToken: string, messages: TextMessage[]): Promise<any> {
    await fetch(`${this.baseUrl}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages,
      }),
    })
  }

  /**
   * push
   */
  async push(userId: string, messages: TextMessage[]): Promise<any> {
    await fetch(`${this.baseUrl}/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages,
      }),
    })
  }

  /**
   * broadcast
   */
  async broadcast(messages: TextMessage[]): Promise<any> {
    await fetch(`${this.baseUrl}/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        messages,
      }),
    })
  }
}
