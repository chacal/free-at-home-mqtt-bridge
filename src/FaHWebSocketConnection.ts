import {SystemAccessPoint, WebSocketMessage} from "freeathome-local-api-client"
import WebSocket from 'ws'
import {clearInterval} from "timers"

const INITIAL_RECONNECT_INTERVAL_MS = 2000
const MAX_RECONNECT_INTERVAL_MS = 60000
const WS_PING_INTERVAL_MS = 10000

export function connectFaHWebsocket(sysAp: SystemAccessPoint, wsMsgProcessor: (msg: WebSocketMessage) => void) {
    const url = `ws://${sysAp.hostName}/fhapi/v1/api/ws`
    let reconnectIntervalMs = INITIAL_RECONNECT_INTERVAL_MS
    connect()

    function connect() {
        const ws = new WebSocket(url, {headers: {Authorization: `Basic ${sysAp.basicAuthKey}`}})
        let pingInterval: NodeJS.Timer
        return new Promise((resolve, reject) => {
            console.log('FaH websocket connecting..')
            ws.on('open', () => {
                console.log('FaH websocket connection established!')
                pingInterval = setInterval(() => ws.ping(), WS_PING_INTERVAL_MS)
                // Connection established -> reset reconnect interval to the default
                reconnectIntervalMs = INITIAL_RECONNECT_INTERVAL_MS
            })

            ws.on('close', () => {
                console.log('FaH websocket connection closed')
                if (pingInterval !== undefined) {
                    clearInterval(pingInterval)
                }
                reject()
            })

            ws.on('message', (data) => wsMsgProcessor(JSON.parse(data.toString())))
            ws.on('error', e => console.log('FaH websocket connection error', e))

        })
            .catch(async e => {
                console.log(`FaH websocket connection reconnecting in ${reconnectIntervalMs}ms..`)
                await new Promise(resolve => setTimeout(resolve, reconnectIntervalMs))
                // Increase reconnect interval exponentially
                reconnectIntervalMs = Math.min(1.5 * reconnectIntervalMs, MAX_RECONNECT_INTERVAL_MS)
                connect()
            })
    }
}
