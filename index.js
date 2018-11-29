const Koa = require('koa')
const route = require('koa-route')
const path = require('path')
const serve = require('koa-static')
const compose = require('koa-compose')
const bodyParser = require('koa-bodyparser')
const cors = require('koa-cors')
const rp = require('request-promise') 
const { Pool } = require('pg')
const app = new Koa()
const database = require('./config')

app.use(bodyParser())
app.use(cors())
app.use(serve(path.join(__dirname, '/public')));

const client = new Pool(database)
function checkProperty(obj, key) {
  return obj.hasOwnProperty(key)
}
// 增加小程序敏感信息
const addMp = async ctx => {
  const seq = ctx.request.body
  // ctx.response.set('Access-Control-Allow-Origin', '*')
  if (!checkProperty(seq, 'name') || !checkProperty(seq, 'appId') || !checkProperty(seq, 'secretKey')) {
    ctx.body = {
      code: 0,
      msg: '入参不正确'
    }
  }
  const checkExist = await client.query('select * from mpqrcode where app_id = $1', [seq.appId])
  if (checkExist.rows.length > 0) {
    ctx.body = {
      code: 0,
      msg: '已有该小程序信息'
    }
  } else {
    const sql = `insert into mpqrcode (name, app_id, secret_key, avatar) values($1, $2, $3, $4)`
    const params = [seq.name, seq.appId, seq.secretKey, seq.avatar]
    const insertResult = await client.query(sql, params)
    if (insertResult) {
      ctx.body = {
        code: 1,
        msg: "插入成功！"
      }
    }
  }
}
// 小程序列表
const getMpList = async ctx => {
  const mpList = await client.query(`select app_id, name, avatar from mpqrcode`)
  ctx.body = {
    code: 1,
    msg: '查询成功',
    data: mpList.rows
  }
}
// 获取二维码
const getCode = async ctx => {
  const seq = ctx.request.body
  const qList = await client.query(`select * from mpqrcode where app_id = $1`, [seq.defaultValue])
  const targetMp = qList.rows[0]
  const result = await rp(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${targetMp.app_id}&secret=${targetMp.secret_key}`)
  const token = JSON.parse(result).access_token
  const data = {
    path: `${seq.path}?${seq.params}`,
    width: seq.width
  }
  const code = await rp({
    uri: `https://api.weixin.qq.com/cgi-bin/wxaapp/createwxaqrcode?access_token=${token}`,
    method: 'post',
    body: data,
    json: true
  })
  ctx.set('Content-Type', 'application/octet-stream')
  ctx.set('Content-Disposition', 'application/octet-stream')
  ctx.body = code.toString('base64')
}

const middlewares = compose([
  route.post('/addMp', addMp),
  route.post('/getCode', getCode),
  route.get('/mpList', getMpList)
])
app.use(middlewares)
app.listen(4000)
console.log('This is a koa demo that run in localhost:4000!')