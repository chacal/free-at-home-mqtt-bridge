import {Configuration, SystemAccessPoint} from "freeathome-local-api-client"
import {
    AL_ABSOLUTE_SET_VALUE_CONTROL,
    AL_COLOR_TEMPERATURE,
    AL_SWITCH_ON_OFF,
    MAX_MIREDS,
    MIN_MIREDS,
    SYS_AP_ID
} from "./Constants"
import throttledQueue from 'throttled-queue'

const TOPIC_REGEX = /^homeassistant\/light\/(.*?)_(.*?)\//m
const CACHED_BRIGHTNESS_SEND_DELAY_MS = 3000

export default class HAMessageHandler {
    private brightnessCache = new BrightnessCache()
    private throttle = throttledQueue(10, 1000, true)

    constructor(private sysAP: SystemAccessPoint, private fahConfig: Configuration) {
    }

    processHAMessage(topic: string, msg: string) {
        const m = topic.match(TOPIC_REGEX)
        if (m !== null) {
            const deviceId = m[1]
            const chId = m[2]

            if (topic.endsWith('switch')) {
                this.handleSwitchMsg(deviceId, chId, msg)
            } else if (topic.endsWith('brightness/set')) {
                this.handleSetBrightnessMsg(deviceId, chId, msg)
            } else if (topic.endsWith('color_temp/set')) {
                this.handleSetColorMsg(deviceId, chId, msg)
            } else if (topic.endsWith('brightness')) {
                this.brightnessCache.set(deviceId, chId, msg)
            }
        }
    }

    private handleSwitchMsg(deviceId: string, chId: string, msg: string) {
        const datapointId = this.findInputDataPointIdForPairingId(deviceId, chId, AL_SWITCH_ON_OFF)
        const payload = msg === 'ON' ? '1' : '0'
        this.setDataPoint(deviceId, chId, datapointId, payload)
    }

    private handleSetBrightnessMsg(deviceId: string, chId: string, msg: string) {
        const datapointId = this.findInputDataPointIdForPairingId(deviceId, chId, AL_ABSOLUTE_SET_VALUE_CONTROL)
        this.brightnessCache.set(deviceId, chId, msg)
        this.setDataPoint(deviceId, chId, datapointId, msg)
    }

    private handleSetColorMsg(deviceId: string, chId: string, msg: string) {
        const datapointId = this.findInputDataPointIdForPairingId(deviceId, chId, AL_COLOR_TEMPERATURE)
        const payload = scaleColorTempFromHAtoFaH(msg)
        this.setDataPoint(deviceId, chId, datapointId, payload)

        // (Re)set brightness to cached value after setting color. Otherwise CT dimmers won't react properly to switch off
        // command in the future.
        setTimeout(() => {
            this.handleSetBrightnessMsg(deviceId, chId, this.brightnessCache.get(deviceId, chId))
        }, CACHED_BRIGHTNESS_SEND_DELAY_MS)
    }

    private findInputDataPointIdForPairingId(deviceId: string, channelId: string, pairingId: number) {
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

    private setDataPoint(deviceId: string, chId: string, datapointId?: string, value?: string) {
        if (datapointId !== undefined && value !== undefined) {
            this.throttle(() => this.sysAP.setDatapoint(SYS_AP_ID, deviceId, chId, datapointId, value))
        }
    }
}

function scaleColorTempFromHAtoFaH(tempFromHa: string) {
    const t = parseInt(tempFromHa)
    return Math.round(((t - MAX_MIREDS) / (MIN_MIREDS - MAX_MIREDS)) * 100).toString()
}

class BrightnessCache {
    private cache: {
        [key: string]: string
    } = {}

    set(deviceId: string, chId: string, brightness: string) {
        this.cache[deviceId + chId] = brightness
    }

    get(deviceId: string, chId: string) {
        return this.cache[deviceId + chId]
    }
}