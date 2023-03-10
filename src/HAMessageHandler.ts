import {Configuration, SystemAccessPoint} from "freeathome-local-api-client"
import {
    AL_ABSOLUTE_SET_VALUE_CONTROL,
    AL_COLOR_TEMPERATURE,
    AL_SWITCH_ON_OFF,
    MAX_MIREDS,
    MIN_MIREDS,
    SYS_AP_ID
} from "./Constants"

const TOPIC_REGEX = /^homeassistant\/light\/(.*?)_(.*?)\//m

export default class HAMessageHandler {
    constructor(private sysAP: SystemAccessPoint, private fahConfig: Configuration) {
    }

    processHAMessage(topic: string, msg: string) {
        const m = topic.match(TOPIC_REGEX)
        if (m !== null) {
            const deviceId = m[1]
            const chId = m[2]

            let datapointId: string | undefined
            let payload: string | undefined

            if (topic.endsWith('switch')) {
                datapointId = this.findInputDataPointIdForPairingId(deviceId, chId, AL_SWITCH_ON_OFF)
                payload = msg === 'ON' ? '1' : '0'
            } else if (topic.endsWith('brightness/set')) {
                datapointId = this.findInputDataPointIdForPairingId(deviceId, chId, AL_ABSOLUTE_SET_VALUE_CONTROL)
                payload = msg
            } else if (topic.endsWith('color_temp/set')) {
                datapointId = this.findInputDataPointIdForPairingId(deviceId, chId, AL_COLOR_TEMPERATURE)
                payload = scaleColorTempFromHAtoFaH(msg)
            }

            if (datapointId !== undefined && payload !== undefined) {
                this.sysAP.setDatapoint(SYS_AP_ID, deviceId, chId, datapointId, payload)
            }
        }
    }

    findInputDataPointIdForPairingId(deviceId: string, channelId: string, pairingId: number) {
        const channel = this.fahConfig[SYS_AP_ID]?.devices[deviceId]?.channels?.[channelId]
        if (channel !== undefined) {
            for (const inputDatapointId in channel.inputs) {
                if (channel.inputs[inputDatapointId].pairingID === pairingId) {
                    return inputDatapointId
                }
            }
        }
        return undefined
    }
}

function scaleColorTempFromHAtoFaH(tempFromHa: string) {
    const t = parseInt(tempFromHa)
    return Math.round(((t - MAX_MIREDS) / (MIN_MIREDS - MAX_MIREDS)) * 100).toString()
}
