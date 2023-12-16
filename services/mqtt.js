const mqtt = require("mqtt");
const {
    watchDevices,
    storeStatus,
    getConfig,
    defaultConfig,
} = require("./firebase");

const TYPE = {
    /* Status
    @params: {
        temperature: number
        epochTime: number
    }
    */
    STATUS: "status",

    /* Action
    @params: {
        id: string
        type: string
        data: string
    }
    */
    ACTION: "action",

    /* Sync
    @params: string
    */
    SYNC: "sync",
};

const mqttClient = mqtt.connect(process.env.VITE_MQTT, {
    connectTimeout: 5000,
});

const handleReceiveMessage = (topic, message) => {
    const type = topic.split("/")[1];
    const device = topic.split("/")[2];
    const data = JSON.parse(message.toString());

    console.log(
        `Received message from [${type}] ${device}: ${JSON.stringify(data)}`
    );

    switch (type) {
        case TYPE.STATUS:
            const temperature = data.temperature;
            const epochTime = data.epochTime;
            storeStatus(device, { temperature, epochTime });
            break;
        case TYPE.ACTION:
            console.log(`Device ${device} action: ${data}`);
            break;
        case TYPE.SYNC:
            getConfig(device)
                .then((config) => {
                    mqttClient.publish(
                        `laplalaplanh/config/${device}`,
                        JSON.stringify(config)
                    );
                })
                .catch((error) => {
                    console.log("--> error getting config", error);
                });
            // mqttClient.publish(
            //     `laplalaplanh/config/${device}`,
            //     JSON.stringify(defaultConfig)
            // );
            break;
        default:
            console.log(`Unknown type: ${type}`);
    }
};

const subscribe = async (devices) => {
    for (const device of devices) {
        mqttClient.subscribe(`laplalaplanh/status/${device}`);
        mqttClient.subscribe(`laplalaplanh/sync/${device}`);
        console.log(`Subscribed to ${device}`);
    }
};

const unsubscribe = async (devices) => {
    for (const device of devices) {
        mqttClient.unsubscribe(`laplalaplanh/status/${device}`);
        mqttClient.unsubscribe(`laplalaplanh/sync/${device}`);
        console.log(`Unsubscribed to ${device}`);
    }
};

const waitForConnection = () => {
    return new Promise((resolve) => {
        mqttClient.on("connect", () => {
            mqttClient.on("message", handleReceiveMessage);
            console.log("MQTT Connected");
            resolve();
        });
    });
};

let devices = [];

const start = async () => {
    await watchDevices((newDevices) => {
        const devicesToAdd = newDevices.filter((x) => !devices.includes(x));
        const devicesToRemove = devices.filter((x) => !newDevices.includes(x));
        devices = newDevices;
        subscribe(devicesToAdd);
        unsubscribe(devicesToRemove);
    });
};

module.exports = {
    waitForConnection,
    start,
};
