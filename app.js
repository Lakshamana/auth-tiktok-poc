require('dotenv').config()

const express = require('express')
const app = express()
const cookieParser = require('cookie-parser')
const cors = require('cors')
const qs = require('querystring')
const bodyParser = require('body-parser')
const axios = require('axios').default

app.use(cookieParser())
app.use(cors())
app.listen(process.env.PORT || 3000)

app.get('/oauth', (req, res) => {
  const csrfState = Math.random().toString(36).substring(2)
  res.cookie('csrfState', csrfState, { maxAge: 60000 })

  let url = 'https://www.tiktok.com/v2/auth/authorize'

  // the following params need to be in `application/x-www-form-urlencoded` format.
  url += '?' + qs.stringify({
    client_id: process.env.CLIENT_KEY,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: 'code',
    scope: process.env.SCOPE,
    state: csrfState
  })

  res.redirect(url)
})

app.get('/redirect', bodyParser({ extended: false }), async (req, res) => {
  const { code, error_description } = req.body

  console.log({ code, error_description })

  if (error_description) {
    return res.status(400).json({ error: error_description })
  }

  try {
    const { data } = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token', {
        client_key: process.env.CLIENT_KEY,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI
      })

    return res.status(200).json({
      accessToken: data.access_token,
      refreshToken: data.refresh_token
    })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
})
