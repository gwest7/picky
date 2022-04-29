# Picky

The function `topicQualifier` is useful for "picking" message interestes from an MQTT message stream by using the RxJs operator `interest`. As the resulting observable is subscribed to and unsubscribed from it will in turn subscribe to and unsubscribe from the specified topic.

## Usage

While subscribed to multiple MQTT topics, including, for example `'a/b/c'`, you receive an MQTT message for the topic `messageTopic`. `topicQualifier` will return `true` if the `messageTopic` qualifies as a valid `subscriptionTopic`.

```ts
const subscriptionTopic = 'a/b/c';
const pic:boolean = topicQualifier(messageTopic, subscriptionTopic);
```

The usefulness of `topicQualifier` is to take wildcards into account.

```js
topicQualifier(messageTopic, 'a/b/+');
topicQualifier(messageTopic, 'a/b/#');
```

`topicQualifier` is also able to return the wildcard matches between the subject topic and specification:
```js
topicQualifier('tele/device0/motion/sensor2', 'tele/+/motion/#', true);
// returns ['device0','sensor2'];

topicQualifier('a/b/c/d/e/f','a/+/+/d/#',true); //-> ['b', 'c', 'e/f']
topicQualifier('a/b/c/d/e/f','a/#',true); //-> ['b/c/d/e/f']
topicQualifier('a/b/c/d/e/f','x/#',true); //-> null
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

```js
const iotDevicesExclLights$ = mqttMessageStream$.pipe(
  interest('tele/lights/+', sub, unsub, ({topic, payload}) => {
    // act on light message
  })
)
```

With the optional `mqtt` dependency we can use the `connect` function to do the following:

```js
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