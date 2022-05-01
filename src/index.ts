import { Observable } from 'rxjs';
import type {
  IClientOptions,
  IClientPublishOptions,
  IPublishPacket,
  IConnectPacket,
  IClientSubscribeOptions,
} from 'mqtt';
import {
  connect as _connect,
} from 'mqtt';

export interface IMsg {
  topic: string;
  payload: Buffer;
  packet: IPublishPacket;
}
export interface IMatchMsg extends IMsg {
  match: string[];
}
export interface IMultiMatchMsg extends IMsg {
  match: [string, string[] | null][];
}
export interface ISub {
  topic: string | string[];
  opts?: IClientSubscribeOptions;
}
export interface IUnsub {
  topic: string | string[];
  opts?: object;
}
export interface IPublishMsg {
  topic: string;
  payload: string | Buffer;
  opts?: IClientPublishOptions;
}

/**
 * Create a client connection to an MQTT broker, manage subscriptions and publications to
 * the client and returns a message stream. The MQTT client automatically reconnects on
 * disconnect and maintains subscriptions (becuase of client identification).
 * @param url The broker URL. Eg: mqtt://localhost
 * @param sub Topic interests (subscribe) as a stream
 * @param unsub Topic disinterests (unsubscribe) as a stream
 * @param pub Message (to be published) as a stream
 * @param opts MQTT client connection options
 * @returns An stream of MQTT messages
 */
export function createMessageStream(
  url: string,
  sub: Observable<ISub>,
  unsub: Observable<IUnsub>,
  pub: Observable<IPublishMsg>,
  options?: IClientOptions,
  onConnect?: (packet?: IConnectPacket) => void,
  onClose?: () => void,
) {
  return new Observable<IMsg>((subscriber) => {
    const mqtt = _connect(url, options);
    mqtt.on('message', (topic, payload, packet) => subscriber.next({ topic, payload, packet }));
    mqtt.on('connect', (packet) => onConnect?.(packet)); // Emitted on successful (re)connection (i.e. connack rc=0)
    mqtt.on('error', (error) => subscriber.error(error));
    mqtt.on('close', () => onClose?.());

    const s = pub.subscribe(({ topic, payload, opts }) => {
      opts ? mqtt.publish(topic, payload, opts) : mqtt.publish(topic, payload);
    });
    s.add(sub.subscribe(({topic, opts}) => {
      if (opts) mqtt.subscribe(topic, opts);
      else mqtt.subscribe(topic);
    }));
    s.add(unsub.subscribe(({topic,opts}) => {
      if (opts) mqtt.unsubscribe(topic, opts);
      else mqtt.unsubscribe(topic);
    }));

    return () => {
      s.unsubscribe();
      mqtt.end();
    };
  });
}

/**
 * Produces an observable that fakes a connection to a MQTT server. Instead it prints out
 * all `subscribe`, `unsubscribe` and `publish` traffic usefull for debugging.
 * @param url Not used
 * @param sub Topic interests (subscribe) as a stream
 * @param unsub Topic disinterests (unsubscribe) as a stream
 * @param pub Message (to be published) as a stream
 * @param fakeMsg$ A stream that could be used to fake incoming messages
 * @returns A stream of MQTT messages fakes using the `fakeMsg$` parameter
 */
export function createMessageStreamDebug(
  url: string,
  sub: Observable<ISub>,
  unsub: Observable<IUnsub>,
  pub: Observable<IPublishMsg>,
  fakeMsg$: Observable<IMsg>,
) {
  return new Observable<IMsg>((subscriber) => {
    console.debug(`CONNECT: ${url}`);
    const s = fakeMsg$.subscribe((msg) => subscriber.next(msg));
    s.add(pub.subscribe(({ topic, payload }) => console.debug(`PUBLISH: [${topic}] ${payload}`)));
    s.add(sub.subscribe(({topic}) => console.debug(`SUB: ${topic.toString()}`)));
    s.add(unsub.subscribe(({topic}) => console.debug(`UNS: ${topic.toString()}`)));
    return () => {
      s.unsubscribe();
    };
  });
}

export function interest(
  topic: string,
  sub: { next: (value:{topic: string}) => void },
  unsub: { next: (value:{topic: string}) => void },
  onMessage?: (msg: IMsg) => void,
): ($: Observable<IMsg>) => Observable<IMsg>;

export function interest(
  topic: string[],
  sub: { next: (value:{topic: string[]}) => void },
  unsub: { next: (value:{topic: string[]}) => void },
  onMessage?: (msg: IMsg) => void,
): ($: Observable<IMsg>) => Observable<IMsg>;

/**
 * Creates an operator that (un)subscribes to topic interests and filters MQTT messages
 * accordingly.
 * @param topic MQTT topic interests
 * @param sub Subject to notify the start of topic intrests
 * @param unsub Subject to notify the end of topic interets
 * @param onMessage If supplied then the operator will remove message interests from the
 * stream and pass them to the callback, if not supplied only message interests will be
 * passed down the stream effectively inverting the filter effect
 * @returns An operator
 */
export function interest<TopicType extends string | string[]>(
  topic: TopicType,
  sub: { next: (value:{topic: TopicType}) => void },
  unsub: { next: (value:{topic: TopicType}) => void },
  onMessage?: (msg: IMsg) => void,
) {
  return ($: Observable<IMsg>): Observable<IMsg> => {
    return new Observable((subscriber) => {
      const qualifiers: string[] = typeof topic === 'string' ? [topic] : topic;
      sub.next({topic});
      const _ = $.subscribe({
        next(msg) {
          const found = !!qualifiers.find(q => topicQualifier(msg.topic, q));
          if (onMessage) {
            if (found) onMessage(msg);
            else subscriber.next(msg);
          } else if (found) {
            subscriber.next(msg);
          }
        },
        error(er) {
          subscriber.error(er);
        },
        complete() {
          subscriber.complete();
        },
      });
      _.add(() => unsub.next({topic}));
      return _;
    });
  };
}

export function topicQualifier(subject: string, specification: string, returnMatches?:false): boolean;
export function topicQualifier(subject: string, specification: string, returnMatches:true): string[] | null;

/**
 * Check if an MQTT message is an interest of a subscriber by comparing the message topic and subscription topic.
 * @param subject The MQTT topic of a message to be validated.
 * @param specification A topic subscription to compare with the subject. Typically contains topic wildcards.
 * @param returnMatches If `false` the function returns `true` is qualified (otherwise `false`). If `true` then
 * wildcard matches are returned as strings. No matches results in a `null`. Every `+` (if matched) will result in
 * strings each representing the text matched by the wildcard. A `#` (if matched) will result in a single string array
 * representing the text matched by the wildcard.
 * @returns Whether the subject fits the specification.
 */
export function topicQualifier(subject: string, specification: string, returnMatches?: boolean): boolean | string[] | null {
  const qualifiers = specification.split('/');
  const actuals = subject.split('/');
  const values = returnMatches ? [] as string[] : null;
  for (let i = 0; i < actuals.length; i++) {
    if (qualifiers.length <= i) return values ? null : false; // remaining actuals won't qualify
    const q = qualifiers[i];
    const a = actuals[i];
    if (q === a) continue; // segment qualifies - continue testing next segment
    if (q === '#') return values ? values.concat(actuals.slice(i).join('/')) : true; // remaining actuals qualify
    if (q === '+') {
      if (values) values.push(a);
      continue; // segment qualifies - continue testing next segment
    }
    return values ? null : false; // actual does not qualify
  }
  if (!values) return actuals.length === qualifiers.length; // remaining qualifiers are not met
  return (actuals.length === qualifiers.length) ? values : null;
}

export function matches(
  topic: string,
  sub: { next: (value:{topic: string}) => void },
  unsub: { next: (value:{topic: string}) => void },
): ($: Observable<IMsg>) => Observable<IMatchMsg>;

export function matches(
  topic: string,
  sub: { next: (value:{topic: string}) => void },
  unsub: { next: (value:{topic: string}) => void },
  onMessage: (msg: IMatchMsg) => void,
): ($: Observable<IMsg>) => Observable<IMsg>;

export function matches(
  topic: string[],
  sub: { next: (value:{topic: string[]}) => void },
  unsub: { next: (value:{topic: string[]}) => void },
): ($: Observable<IMsg>) => Observable<IMultiMatchMsg>;

export function matches(
  topic: string[],
  sub: { next: (value:{topic: string[]}) => void },
  unsub: { next: (value:{topic: string[]}) => void },
  onMessage: (msg: IMultiMatchMsg) => void,
): ($: Observable<IMsg>) => Observable<IMsg>;

/**
 * Creates an operator that (un)subscribes to topic interests and filters MQTT messages
 * accordingly.
 * @param topic MQTT topic interests
 * @param sub Subject to notify the start of topic intrests
 * @param unsub Subject to notify the end of topic interets
 * @param onMessage If supplied then the operator will remove message interests from the
 * stream and pass them to the callback, if not supplied only message interests will be
 * passed down the stream effectively inverting the filter effect
 * @returns An operator
 */
 export function matches<TopicType extends string | string[], MsgType extends IMatchMsg | IMultiMatchMsg>(
  topic: TopicType,
  sub: { next: (value:{topic: TopicType}) => void },
  unsub: { next: (value:{topic: TopicType}) => void },
  onMessage?: (msg: MsgType) => void,
) {
  return ($: Observable<IMsg>): Observable<IMsg | MsgType> => {
    return new Observable((subscriber) => {
      const qualifiers: string[] = typeof topic === 'string' ? [topic] : topic;
      sub.next({topic});
      const _ = $.subscribe({
        next(msg) {
          const matchMsg = msg as MsgType;
          const match: [string, string[] | null][] = qualifiers.map(q => [q,topicQualifier(msg.topic, q, true)]);
          const found = !!match.find(m => m[1] !== null);
          if (found) matchMsg.match = typeof topic === 'string' ? match[0][1] as string[] : match;
          if (onMessage) {
            if (found) onMessage(matchMsg);
            else subscriber.next(msg);
          } else if (found) {
            subscriber.next(matchMsg);
          }
        },
        error(er) {
          subscriber.error(er);
        },
        complete() {
          subscriber.complete();
        },
      });
      _.add(() => unsub.next({topic}));
      return _;
    });
  };
}
