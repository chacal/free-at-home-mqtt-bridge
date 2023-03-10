import {Configuration, Device, WebSocketMessage} from "freeathome-local-api-client"
import {MqttClient} from "mqtt"
import {
    AL_INFO_ACTUAL_DIMMING_VALUE,
    AL_INFO_COLOR_TEMPERATURE,
    AL_INFO_ON_OFF,
    MAX_MIREDS,
    MIN_MIREDS,
    SYS_AP_ID
} from "./Constants"

const ODP_PATH_REGEX = /^(.*)\/(.*)\/(odp.*)$/m


export default class FaHMessageHandler {
    constructor(private mqttClient: MqttClient, private fahConfig: Configuration) {
    }

    processFaHMessage(msg: WebSocketMessage) {
        for (const dpPath in msg[SYS_AP_ID]?.datapoints) {
            const m = dpPath.match(ODP_PATH_REGEX)
            if (m !== null) {
                this.publishOdpStateToHA(m[1], m[2], m[3], msg[SYS_AP_ID].datapoints[dpPath])
            }
        }
    }

    publishStatesForConfig(conf: Configuration) {
        for (const deviceId in conf[SYS_AP_ID].devices) {
            const dev = conf[SYS_AP_ID].devices[deviceId]
            this.publishDeviceStateToHA(deviceId, dev)
        }
    }

    private publishOdpStateToHA(deviceId: string, channelId: string, dataPointId: string, dataPointValue?: string) {
        const channel = this.fahConfig[SYS_AP_ID]?.devices[deviceId]?.channels?.[channelId]
        if (channel !== undefined && dataPointValue !== undefined) {
            if (channel.outputs?.[dataPointId]?.pairingID === AL_INFO_ON_OFF) {
                this.mqttClient.publish(
                    `homeassistant/light/${deviceId}_${channelId}/status`,
                    dataPointValue === '1' ? 'ON' : 'OFF',
                    {retain: true}
                )
            }
            if (channel.outputs?.[dataPointId]?.pairingID === AL_INFO_ACTUAL_DIMMING_VALUE) {
                this.mqttClient.publish(
                    `homeassistant/light/${deviceId}_${channelId}/brightness`,
                    dataPointValue,
                    {retain: true}
                )
            }
            if (channel.outputs?.[dataPointId]?.pairingID === AL_INFO_COLOR_TEMPERATURE) {
                this.mqttClient.publish(
                    `homeassistant/light/${deviceId}_${channelId}/color_temp`,
                    scaleColorTempFromFaHtoHA(dataPointValue),
                    {retain: true}
                )
            }
        }
    }

    private publishDeviceStateToHA(deviceId: string, dev: Device) {
        for (const chId in dev.channels) {
            const ch = dev.channels[chId]
            for (const odpId in ch.outputs) {
                this.publishOdpStateToHA(deviceId, chId, odpId, ch.outputs[odpId].value)
            }
        }
    }
}

function scaleColorTempFromFaHtoHA(tempFromFaH: string) {
    const t = parseInt(tempFromFaH)
    return Math.round(((t - 100) / (0 - 100)) * (MAX_MIREDS - MIN_MIREDS) + MIN_MIREDS).toString()
}
