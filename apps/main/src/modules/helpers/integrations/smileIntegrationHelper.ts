import axios from 'axios'
import { db } from '@/common/infrastructure/database/index.js'
import env from '@/config/env.js'

const SMILE_URL = env.SMILE_URL

export async function getSmileHeader(username: string, password: string) {
  const user = await db
    .selectFrom('users')
    .select(['token_login', 'last_login', 'username', 'id'])
    .where('username', '=', username)
    .executeTakeFirst()

  const today = new Date()
  const lastLogin = user?.last_login ? new Date(user.last_login) : null
  
  let token = user?.token_login || null
  
  // Check if token is older than 4 days or null
  if (!lastLogin || !token || (today.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24) > 4) {
    // Generate new token
    const smileLogin = await axios({
      method: 'POST',
      url: `${SMILE_URL}/auth/login`,
      data: {
        username: username,
        password: password
      }
    })
    
    token = smileLogin.data.token_login
    
    // Update user token and last login
    await db
      .updateTable('users')
      .set({
        token_login: token,
        last_login: today
      })
      .where('username', '=', username)
      .execute()
  }
  
  return {
    Authorization: `Bearer ${token}`
  }
}