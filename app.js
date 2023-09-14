require('dotenv').config()

const express = require('express')
const app = express()
const cookieParser = require('cookie-parser')
const cors = require('cors')
const qs = require('querystring')
const bodyParser = require('body-parser')
const path = require('path')
const axios = require('axios').default

app.use(cookieParser())
app.use(cors())

app.get('/', (_, res) => { res.sendFile(path.join(__dirname, 'index.html')) })
app.get('/user/show', (_, res) => { console.log('test'); res.sendFile(path.join(__dirname, 'user-detail.html')) })

const auth = refreshToken => {
  return axios.post(
    'https://open.tiktokapis.com/v2/oauth/token', {
      client_key: process.env.CLIENT_KEY,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
    .then(({ data }) => data.access_token)
    .catch(err => err)
}

app.get('/oauth', (_, res) => {
  const csrfState = Math.random().toString(36).substring(2)
  res.cookie('csrfState', csrfState, { maxAge: 60000 })

  // the following params need to be in `application/x-www-form-urlencoded` format.
  const url = 'https://www.tiktok.com/v2/auth/authorize?' + qs.stringify({
    client_key: process.env.CLIENT_KEY,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: 'code',
    scope: process.env.SCOPE,
    state: csrfState
  })

  res.redirect(url)
})

app.post('/redirect', bodyParser, async (req, res) => {
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

    res.redirect(`/user/retrieve?access_token=${data.access_token}&refresh_token=${data.refresh_token}`)

    return res.status(200).json({ access_token })
  } catch (error) {
    return res.status(401).json({ error: error.message })
  }
})

app.get('/user/retrieve', async (req, res, next) => {
  const { access_token, refresh_token } = req.query

  try {
    const userDataResponse = await axios.get(
      'https://open.tiktokapis.com/v2/user/info', {
        params: {
          fields: 'open_id,avatar_url,display_name,is_verified,profile_deep_link'
        },
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      }
    )

    const params = {
      avatar_url: userDataResponse.data.avatar_url,
      username: userDataResponse.data.display_name,
      like_count: userDataResponse.data.like_count,
      follower_count: userDataResponse.data.follower_count,
      is_verified: userDataResponse.data.is_verified
    }

    res.redirect(`/user/show?${qs.stringify(params)}`)

    return res.status(200).json({ data: userDataResponse.data })
  } catch (error) {
    if (error.response.code === 'access_token_invalid') {
      const authResponse = await auth(refresh_token)
        .catch(err => res.status(424).json({ error: err.message }))

      res.redirect(`/user/retrieve?access_token=${authResponse.data.access_token}&refresh_token=${authResponse.data.refresh_token}`)
      return
    }

    res.redirect('/?error=true&error_description=' + error.message)
    return res.status(400).json({ error: error.message })
  }
})

app.listen(process.env.PORT || 3000)
