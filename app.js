const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()
app.use(express.json())

let db = null
const dbpath = path.join(__dirname, 'twitterClone.db')

const initialiseDBAndServer = async (request, response) => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error:${e.message}`)
    process.exit(1)
  }
}

initialiseDBAndServer()
//api1
app.post('/register/', async (request, response) => {
  const userdetails = request.body
  const {username, password, name, gender} = userdetails
  const userQuery = `select * from user where username='${username}'`
  const userArray = await db.get(userQuery)
  if (userArray !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (password.length > 5) {
      const haspassword = await bcrypt.hash(password, 10)
      const updateQuery = `insert into user(username,password,name,gender)
      values('${username}','${haspassword}','${name}','${gender}')`
      await db.run(updateQuery)
      response.status(200)
      response.send('User created successfully')
    } else {
      response.status(400)
      response.send('Password is too short')
    }
  }
})
//api2
app.post('/login/', async (request, response) => {
  const userdetails = request.body
  const {username, password} = userdetails
  const loginQuery = `select * from user where username='${username}'`
  const loginArray = await db.get(loginQuery)
  if (loginArray === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const loginpassword = await bcrypt.compare(password, loginArray.password)
    if (loginpassword === true) {
      const jwtToken = jwt.sign(loginArray, 'chanderraju')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})
//authentication
const authenticateToken = (request, response, next) => {
  let jwtcode = null
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtcode = authHeader.split(' ')[1]
  }
  if (jwtcode === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtcode, 'chanderraju', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}
//ap3
const coverttostring = dbstring => {
  return {
    username: dbstring.username,
    tweet: dbstring.tweet,
    dateTime: dbstring.dateTime,
  }
}

app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  const {payload} = request
  console.log(payload)
  const {username, user_id} = payload
  const getTweetQuery = `select username,tweet,date_time as dateTime from follower inner join tweet on follower.following_user_id.=tweet.user_id 
  inner join user on user.user_id=follower.following_user_id
  where follower.follower_user_id=${userId}
  order by date_time desc 
  limit 4`
  const getTweetArray = await db.all(getTweetQuery)
  response.send(getTweetArray.map(each => coverttostring(each)))
})

//api4
const convertusername = dbstring => {
  return {
    name: dbstring.username,
  }
}
app.get('/user/following/', authenticateToken, async (request, response) => {
  const {payload} = request
  console.log(payload)
  const {username, userId} = payload
  const fourQuery = `select username 
  from user inner join follower on user.user_id=follower.following_user_id
  where follower.follower_user_id=${user_id}
  `
  const fourArray = await db.all(fourQuery)
  response.send(fourArray.map(each => convertusername(each)))
})
//api5

app.get('/user/followers/', authenticateToken, async (request, response) => {
  const fithQuery = `select username 
  from user inner join follower on user.user_id=follower.follower_user_id
  where follower.following_user_id=${user_id}`
  const fithArray = await db.all(fithQuery)
  response.send(fithArray.map(each => convertusername(each)))
})
//api6
app.get('/tweets/:tweetId/', async (request, response) => {
  const {tweetId} = request
  console.log(tweetId)
  const {payload} = request
  const {user_id, name, username, gender} = payload
  const tweetQuery = `select * from tweet where tweet_id=${tweetId}`
  const tweetresult = await db.get(tweetQuery)
  const userFollowersQuery = `select username from user inner join follower
     on user.user_id=follower.following_user_id 
     where follower.follower_user_id=${user_id}`
  const userFollowers = await db.all(userFollowersQuery)
  if (
    userFollowers.some(item => item.following_user_id === tweetresult.user_id)
  ) {
    const getTweetdetailsQuery = `select tweet,
      count(distinct(like.like_id)) as likes,
      count(distinct(reply.reply_id)) as replies,
      tweet.date_time as dateTime 
      from tweet inner join like on tweet.tweet_id=like.tweet_id 
      inner join reply on reply.tweet_id=tweet.tweet_id`
    const tweetDetails = await db.get(getTweetdetailsQuery)
    response.send(tweetDetails)
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

//api7

app.get(
  '/tweets/:tweetId/likes/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request
    console.log(tweetId)
    const {payload} = request
    const {user_id, name, username, gender} = payload
    const seventhQuery = `select * from  follower inner join on  tweet follower.follower_user_id=tweet.user_id
  inner join like on like.tweet_id=tweet.tweet_id inner join on  user user.user_id =like.user_id 
  where tweet.tweet_id=${tweetId} and follower.follower_user_id=${user_id}`
    const seventhArray = await db.all(seventhQuery)
    if (seventhArray.lenth !== 0) {
      let likes = []
      const getlikedusers = array => {
        for (let item of seventhArray) {
          arr.push(item.username)
        }
      }
      getlikedusers(seventhArray)
      response.send({likes})
    } else {
      response.staus(401)
      response.send('Invalid Request')
    }
  },
)

//api8
app.get(
  '/tweets/:tweetId/replies/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request
    console.log(tweetId)
    const {payload} = request
    const {user_id, name, username, gender} = payload
    const eighthQuery = `select * from follower inner join tweet on following.following_user_id = tweet.user_id 
  inner join reply on reply.tweet_id = tweet.tweet_id inner join user on user.user_id=reply.user_id 
  where tweet.tweet_id=${tweetId} and follower.following_user_id=${user_id}`
    const eigthArray = await db.all(eighthQuery)
    if (eigthArray.lenth !== 0) {
      let replies = []
      const getrepliesusers = array => {
        for (let item of eightArray) {
          let object = {
            name: item.name,
            reply: item.reply,
          }
          replies.push(object)
        }
      }
      getrepliesusers(eightArray)
      response.send({replies})
    } else {
      response.staus(401)
      response.send('Invalid Request')
    }
  },
)
//api9
app.get('/user/tweets/', authenticateToken, async (request, response) => {
  const {payload} = request
  const {user_id, name, username, gender} = payload
  const ninthQuery = `select tweet,
    count(distinct(like.like_id)) as likes,
    count(distinct(reply.reply_id)) as replies,
    tweet.date_time as dateTime 
    from user inner join tweet on user.user_id = tweet.user_id 
    inner join like on tweet.tweet_id=like.tweet_id inner join reply on 
    like.user_id=reply.user_id 
    where user_id=${user_id}
    group by tweet.tweet_id`
  const ninthArray = await db.get(ninthQuery)
  response.send(ninthArray)
})
//api10
app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const {tweet} = request
  const {tweetId} = request
  const {payload} = request
  const {user_id, name, username, gender} = payload
  const tenthQuery = `insert into tweet(tweet,user_id)
  values('${tweet}',${user_id})`
  await db.run(tenthQuery)
  response.send('Created a Tweet')
})

//api11
app.delete('/tweets/:tweetId', authenticateToken, async (request, response) => {
  const {tweetId} = request
  const {payload} = request
  const {user_id, name, username, gender} = payload

  const seletDeleteQuery = `select * from tweet where tweet.userId=${user_id} and tweet.tweet_id=${tweetId} `
  const selectArray = await db.get(seletDeleteQuery)
  if (selectArray.length !== 0) {
    const eleventhQuery = `delete from tweet 
    where tweet.userId=${user_id} and tweet.tweet_id=${tweetId}`
    await db.run(eleventhQuery)
    response.send('Tweet Removed')
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

module.exports = app
