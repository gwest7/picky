# Picky

The function `topicQualifier` is useful for "picking" message interestes from an MQTT message stream by using the RxJs operator `interest`. As the resulting observable is subscribed to (and unsubscribed from) it will in turn subscribe to (and unsubscribe from) the specified MQTT topic.

## Usage

While subscribed to multiple MQTT topics, including, for example `'a/b/c'`, you receive an MQTT message for the topic `messageTopic`. `topicQualifier` will return `true` if the `messageTopic` qualifies as a valid `subscriptionTopic`.

```ts
const subscriptionTopic = 'a/b/c';
const pic:boolean = topicQualifier(messageTopic, subscriptionTopic);
```

The usefulness of `topicQualifier` is clear when wildcards are used.

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

The operator `interest` acts as an RxJs filter by making use of `topicQualifier`. The `interest` operator also manages its own MQTT topic subscription.

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

// isolate MQTT messages we are interested in
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

Using the `mqtt` client we can use the `createMessageStream` function to do the following:

```js
const host = 'localhost:1883';
const sub = new Subject();
const unsub = new Subject();
const pub = new Subject();

// create an MQTT message stream
const msg$ = createMessageStream(host, sub, unsub, pub);

// isolate messages for light switches
const light$ = msg$.pipe(interest('tele/switch/light/+', sub, unsub));

// control the power of the lights
// Note that only when subscribed does the operator subscribe
// to the MQTT topic
const subscription = light$.subscribe(({topic, payload}) => {
  const LightPin = topic.split('/').pop();
  // then assuming the payload is correct...
  pub.next({topic:`cmnd/light/${lightPin}`, payload});
});

// the operator in turn unsubscribes from the MQTT topic
subscription.unsubscribe();
```

To have all communication printed instead of communicating with an MQTT broker use the `createMessageStreamDebug` function.
```js
const msg$ = createMessageStreamDebug(host, sub, unsub, pub);
```

The `matches` operator works exactly the same as the `interest` operator, but in addition to filtering topic interests it also adds a `match` property to the value. This value contains the wildcard matches as described previously. With this we don't have to manipulate topic strings to get identifiers from the message topic. The previous code snippet can then be done like this:

```js
const host = 'localhost:1883';
const sub = new Subject();
const unsub = new Subject();
const pub = new Subject();

const msg$ = createMessageStream(host, sub, unsub, pub);

const light$ = msg$.pipe(matches('tele/switch/light/+', sub, unsub));

const subscription = light$.subscribe(({topic, payload, match}) => {
  // one wildcard (`+`) will result in one matched wildcard value
  const [LightPin] = match;
  pub.next({topic:`cmnd/light/${LightPin}`, payload});
});

subscription.unsubscribe();
```

When using multiple topics with `matches` the resulting `match` object becomes a bit more detailed.

```js
// Given the message topic
`tele/room1/device2/sensor1/12`
// `matches` will have the following results:

// single topic
matches('tele/+/+/#', sub, unsub)
// results in
['room1', 'device2', 'sensor1/12']

// multiple topics
matches(['tele/+/+/#','proxied_tele/+/+/#'], sub, unsub)
// results in an array lookup list with wildcard matches for each topic
[
  ['tele/+/+/#', ['room1', 'device2', 'sensor1/12']],
  ['proxied_tele/+/+/#', null],
]
```