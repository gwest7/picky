# Picky

The function `topicQualifier` is useful for "picking" message interestes from an MQTT message stream by using the RxJs operator `interest`. As the resulting observable is subscribed to and unsubscribed from it will in turn subscribe to and unsubscribe from the specified topic.

## Usage

While subscribed to multiple MQTT topics, including, for example `'a/b/c'`, you receive an MQTT message for the topic `messageTopic`. 

```ts
const subscriptionTopic = 'a/b/c';
const pic:boolean = topicQualifier(subscriptionTopic, messageTopic);
```

The whole point of `topicQualifier` is to take wildcards into account.

```js
topicQualifier('a/b/+', messageTopic);
topicQualifier('a/b/#', messageTopic);
```

The operator `interest` acts as an RxJs filter. The operator also manages its own subscription. When being subscribed to it will subscribe to the topic of interest. When unsubscribed from it will unsubscribe from the topic of interest.

```ts
const sub = {
  next(topics: string | string[]) {
    // mqttClient.subscribe(topics);
  }
};
const unsub = {
  next(topics: string | string[]) {
    // mqttClient.unsubscribe(topics);
  }
};
const lights$ = mqttMessageStream$.pipe(
  interest('tele/lights/+', sub, unsub)
)
```

The `interest` operator can also act as a filter which instead removes qualified messages from the stream and passes them to a callback.

```ts
const iotDevicesExclLights$ = mqttMessageStream$.pipe(
  interest('tele/lights/+', sub, unsub, ({topic, payload}) => {
    // act on light message
  })
)
```

With the optional `mqtt` dependency we can use the `connect` function to do the following:

```ts
const host = 'localhost:1883';
const sub = new Subject();
const unsub = new Subject();
const pub = new Subject();

// create an MQTT message stream
const msgStream$ = connect(host, sub, unsub, pub);

// isolate messages for light switches
const light$ = msgStream$.pipe(interest('tele/switch/light/+', sub, unsub));

// control the power of the lights
// note that only when subscribed does the operator subscribe to the MQTT topic
const subscription = light$.subscribe(({topic, payload}) => {
  const LightPin = topic.split('/').pop();
  pub.next({topic:`cmnd/light/${lightPin}`, payload})
});

subscription.unsubscribe(); // the operator in turn unsubscribes from the MQTT topic
```