const express = require('express')
const dotenv = require('dotenv')
const bodyParser = require('body-parser')
const axios = require('axios')
const fs = require('fs')

const app = express()

app.use(bodyParser.json())
dotenv.config()

const TOKEN = process.env.TOKEN
const SERVICE_URL = process.env.SERVICE_URL
const TG_API = `https://api.telegram.org/bot${TOKEN}`

var config = {}
var activeClients = {}

const init = async () => {
    console.log('   reading config file')
    try {
        fs.readFile('./config.json', 'utf-8', (err, data) => {
            if (err)
            {
                throw err
            }
            config = JSON.parse(data)
        })
    }
    catch (err)
    {
        console.clear()
        console.warn(`🔴 fatal error: ${err}`)
        process.exit()
    }
    console.log('   setting up the webhook')
    try {
        await axios.get(`${TG_API}/setWebhook?url=${SERVICE_URL}/webhook`)
        console.log('🆗 webhook seted')
        setTimeout(() => {
            console.clear()
            console.log('🟢 bot is running')
        }, 1000)
    }
    catch (err) {
        console.clear()
        console.warn(`🔴 fatal error: ${err.response.data.description}`)
        process.exit()
    }
}

const sendMsg = async (id, msg, markDown) => {
    try {
        if (markDown)
        {
            await axios.get(encodeURI(`${TG_API}/sendMessage?chat_id=${id}&text=${msg}&parse_mode=MarkdownV2`))
        }
        else
        {
            await axios.get(encodeURI(`${TG_API}/sendMessage?chat_id=${id}&text=${msg}`))
        }
        console.log('📤 message sent')
    }
    catch (err) {
        console.warn(`❌ error: ${err}`)
    }
}

const createInviteLink = async () => {
    try {
        let response = await axios.get(encodeURI(`${TG_API}/createChatInviteLink?chat_id=-1001600974795&member_limit=1`))
        return response.data.result.invite_link
    }
    catch (err) {
        console.warn(`❌ error: ${err}`)
        return false
    }
}

const getQuestion = (qid) => {
    let text = `请回答：\n${config.questions[qid].text}`
    for (let key in config.questions[qid].answers)
    {
        text = text + `\n /${String.fromCharCode(parseInt(key) + 65)} ${config.questions[qid].answers[key]}`
    }
    return text
}

app.post('/webhook', async (req, res) => {
    // console.log(req.body)
    console.log('📥 received message')
    res.json({ ok: true })

    if ('message' in req.body)
    {
        let buddyID = req.body.message.chat.id
        let buddyName = req.body.message.chat.first_name
        let msg = req.body.message.text
        if (msg in config)
        {
            sendMsg(buddyID, config[msg].replace('#BUDDY', buddyName))
        }
        else
        {
            if (msg === '/begin')
            {
                activeClients[buddyID] = {
                    stat: 0,
                    score: 0,
                    progress: 0
                }
                sendMsg(
                    buddyID,
                    getQuestion(activeClients[buddyID].progress)
                )
            }
            else if (buddyID in activeClients)
            {
                // 答题状态
                if (activeClients[buddyID].stat === 0)
                {
                    const ansSelector = {
                        '/A': 0,
                        '/B': 1,
                        '/C': 2,
                        '/D': 3
                    }
                    let selected = ansSelector[msg]
                    activeClients[buddyID].score += config.questions[activeClients[buddyID].progress].score[selected]
                    activeClients[buddyID].progress++
                    if (activeClients[buddyID].progress in config.questions)
                    {
                        sendMsg(
                            buddyID,
                            getQuestion(activeClients[buddyID].progress)
                        )
                    }
                    else
                    {
                        const categories = config.levels
                        sendMsg(
                            buddyID,
                            `你的最终分数为：${activeClients[buddyID].score}\n一眼丁真鉴定为: ${categories[parseInt(activeClients[buddyID].score / (activeClients[buddyID].progress * 3))]}`
                        )
                        console.log(`👮 ${buddyName}'s censor have been finished, end up with score ${activeClients[buddyID].score}`)
                        if (activeClients[buddyID].score >= activeClients[buddyID].progress * config.minScore)
                        {
                            let link = await createInviteLink()
                            if (link)
                            {
                                sendMsg(
                                    buddyID,
                                    `恭喜你通过测试 [点击加入频道](${link})`,
                                    true
                                )
                            }
                            else
                            {
                                sendMsg(
                                    buddyID,
                                    `内部错误`
                                )
                            }
                        }
                        else
                        {
                            setTimeout(() => {
                                sendMsg(
                                    buddyID,
                                    `滚`
                                )
                            }, 1000)
                        }
                    }
                }
            }
        }
    }
    
})

app.listen(process.env.PORT || 1333, async () => {
    console.clear()
    console.log('🟡 bot is booting')
    console.log('🚀 starting bot...')
    await init()
})