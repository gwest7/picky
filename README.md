# Picky

The method `topicQualifier` is useful for testing is a received MQTT message is due to a specific subscription topic. The RxJs operator `interest` makes use of this method to subscribe to the provided topic and filtering incoming messages by that topic.

## Usage

While subscribed to multiple MQTT topics including, for example `'a/b/c'`, you receive an MQTT message for the topic `messageTopic`. 

```js
const subscriptionTopic = 'a/b/c';
const qualifies = topicQualifier(subscriptionTopic, messageTopic);
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