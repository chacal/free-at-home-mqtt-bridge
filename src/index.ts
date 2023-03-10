import {SystemAccessPoint} from "freeathome-local-api-client"
import {IPublishPacket} from "mqtt-packet"
import FaHMessageHandler from "./FaHMessageHandler"
import HAMessageHandler from "./HAMessageHandler"
import MqttDiscoveryPublisher from "./MqttDiscoveryPublisher"
import {connectFaHWebsocket} from "./FaHWebSocketConnection"
import mqtt = require('mqtt')
import * as dotenv from 'dotenv'

dotenv.config()
validateEnvironmentVariables()

const sysAp = new SystemAccessPoint(
    process.env.SYS_AP_HOSTNAME ?? '',
    process.env.SYS_AP_USERNAME ?? '',
    process.env.SYS_AP_PASSWORD ?? '',
    false,
    true
)

const client = mqtt.connect(process.env.MQTT_BROKER_URL ?? '', {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clientId: 'free-at-home',
    clean: true
})
client.on('connect', () => console.log('Connected to MQTT server'))
client.on('offline', () => console.log('Disconnected from MQTT server'))
client.on('error', (e) => console.log('MQTT client error', e))


sysAp.getConfiguration()
    .then(conf => {
        const discoveryPublisher = new MqttDiscoveryPublisher(client)
        discoveryPublisher.publishDiscoveriesForConfig(conf)

        const fahMsgHandler = new FaHMessageHandler(client, conf)
        fahMsgHandler.publishStatesForConfig(conf)  // Publish initial states for all devices to HA
        connectFaHWebsocket(sysAp, msg => fahMsgHandler.processFaHMessage(msg))

        const haMsgHandler = new HAMessageHandler(sysAp, conf)
        client.on('message', (topic: string, payload: Buffer, packet: IPublishPacket) => {
            haMsgHandler.processHAMessage(topic, payload.toString())
        })
        client.subscribe('homeassistant/light/#')
    })

function validateEnvironmentVariables() {
    const variables = ['SYS_AP_HOSTNAME', 'SYS_AP_USERNAME', 'SYS_AP_PASSWORD', 'MQTT_BROKER_URL', 'MQTT_USERNAME', 'MQTT_PASSWORD']
    variables.forEach(e => {
        if (process.env[e] === undefined) {
            console.error(`${e} environment variable is not set!`)
            process.exit(1)
        }
    })
}