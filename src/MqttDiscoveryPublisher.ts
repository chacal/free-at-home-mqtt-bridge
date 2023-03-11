import {MqttClient} from "mqtt"
import {Configuration, Device} from "freeathome-local-api-client"
import {
    FID_COLORTEMPERATURE_ACTUATOR,
    FID_DIMMING_ACTUATOR,
    FID_SWITCH_ACTUATOR, MAX_MIREDS,
    MIN_MIREDS,
    SYS_AP_ID
} from "./Constants"


export default class MqttDiscoveryPublisher {
    constructor(private mqttClient: MqttClient) {
    }

    publishDiscoveriesForConfig(conf: Configuration) {
        for (const deviceId in conf[SYS_AP_ID].devices) {
            const dev = conf[SYS_AP_ID].devices[deviceId]
            this.processDevice(deviceId, dev)
        }
    }

    private processDevice(deviceId: string, dev: Device) {
        for (let chId in dev.channels) {
            const ch = dev.channels[chId]
            if (ch.functionID === FID_SWITCH_ACTUATOR) {
                this.sendDiscovery(deviceId, chId, discoveryDataForSwitchLight(deviceId, chId, ch.displayName))
            } else if (ch.functionID === FID_DIMMING_ACTUATOR) {
                this.sendDiscovery(deviceId, chId, discoveryDataForDimLight(deviceId, chId, ch.displayName))
            } else if (ch.functionID === FID_COLORTEMPERATURE_ACTUATOR) {
                this.sendDiscovery(deviceId, chId, discoveryDataForCCTLight(deviceId, chId, ch.displayName))
            }
        }
    }

    private sendDiscovery(deviceId: string, chId: string, discoveryData: {}) {
        this.mqttClient.publish(`homeassistant/light/${deviceId}_${chId}/config`, JSON.stringify(discoveryData), {retain: true})
    }
}

function discoveryDataForSwitchLight(deviceId: string, chId: string, name?: string) {
    return {
        '~': `homeassistant/light/${deviceId}_${chId}`,
        name: name ?? 'N/A',
        state_topic: '~/status',
        command_topic: '~/switch',
        object_id: `${deviceId}_${chId}`,
        unique_id: `${deviceId}_${chId}`
    }
}

function discoveryDataForDimLight(deviceId: string, chId: string, name?: string) {
    return Object.assign(discoveryDataForSwitchLight(deviceId, chId, name), {
        brightness_state_topic: '~/brightness',
        brightness_command_topic: '~/brightness/set',
        brightness_scale: 100,
        on_command_type: 'brightness'
    })
}

function discoveryDataForCCTLight(deviceId: string, chId: string, name?: string) {
    return Object.assign(discoveryDataForDimLight(deviceId, chId, name), {
        color_temp_state_topic: '~/color_temp',
        color_temp_command_topic: '~/color_temp/set',
        min_mireds: MIN_MIREDS,
        max_mireds: MAX_MIREDS
    })
}
