import { Subject } from 'rxjs';
import { IMsg, interest, matches, topicQualifier } from '../index';

test('Topic qualifier', () => {
  expect(topicQualifier('a/b/c','a/b/c/d')).toBe(false);
  expect(topicQualifier('a/b/c','a/b/c/d',true)).toBeNull();
  expect(topicQualifier('a/b/c','a/b/c')).toBe(true);
  expect(topicQualifier('a/b/c','a/b/c',true)?.length).toStrictEqual(0);
  expect(topicQualifier('a/b/c','a/b')).toBe(false);
  expect(topicQualifier('a/b/c','a/b',true)).toBeNull();

  expect(topicQualifier('a/b/c','a/+/c')).toBe(true);
  expect(topicQualifier('a/b/c','a/+/c',true)?.join('|')).toBe('b');
  expect(topicQualifier('a/b/c/d','a/+/+')).toBe(false);
  expect(topicQualifier('a/b/c/d','a/+/+/#')).toBe(true);
  expect(topicQualifier('a/b/c/d','a/+/+/#',true)?.join('|')).toBe('b|c|d');

  expect(topicQualifier('a/b/c/d/e','a/+/+/#')).toBe(true);
  expect(topicQualifier('a/b/c/d/e','a/+/+/#',true)?.join('|')).toBe('b|c|d/e');
  expect(topicQualifier('a/b/c','a/+/+')).toBe(true);
  expect(topicQualifier('a/b/c','a/+/+',true)?.join('|')).toBe('b|c');
  expect(topicQualifier('a/b','a/+/+')).toBe(false);
  expect(topicQualifier('a/b/c/d/e','a/+/+/d')).toBe(false);
  expect(topicQualifier('a/b/c/d/e','a/+/+/d/#')).toBe(true);
  expect(topicQualifier('a/b/c/d/e','a/+/+/d/#',true)?.join('|')).toBe('b|c|e');
  expect(topicQualifier('a/b/c/d/e/f','a/+/+/d/#')).toBe(true);
  expect(topicQualifier('a/b/c/d/e/f','a/+/+/d/#',true)?.join('|')).toBe('b|c|e/f');

  expect(topicQualifier('a/b/c/d','a/+/+/d')).toBe(true);
  expect(topicQualifier('a/b/c/d','a/+/+/d',true)?.join('|')).toBe('b|c');
  expect(topicQualifier('a/b/c','a/+/+/d')).toBe(false);
  expect(topicQualifier('a/b/c/d','a/+/c/+')).toBe(true);
  expect(topicQualifier('a/b/c/d','a/+/c/+',true)?.join('|')).toBe('b|d');
  expect(topicQualifier('a/b/c','+/b/c')).toBe(true);
  expect(topicQualifier('a/b/c','+/b/c',true)?.join('|')).toBe('a');
  expect(topicQualifier('a/b','+/b/c')).toBe(false);
  expect(topicQualifier('a/b/c','+/b/+')).toBe(true);
  expect(topicQualifier('a/b/c','+/b/+',true)?.join('|')).toBe('a|c');
  
  expect(topicQualifier('a/b/c','a/b/#')).toBe(true);
  expect(topicQualifier('a/b/c','a/b/#',true)?.join('|')).toBe('c');
  expect(topicQualifier('a/b/c','a/#')).toBe(true);
  expect(topicQualifier('a/b/c','a/#',true)?.join('|')).toBe('b/c');
  expect(topicQualifier('a/b/c','#')).toBe(true);
  expect(topicQualifier('a/b/c','#',true)?.join('|')).toBe('a/b/c');
  expect(topicQualifier('a/b/c','+/b/#')).toBe(true);
  expect(topicQualifier('a/b/c','+/b/#',true)?.join('|')).toBe('a|c');
  expect(topicQualifier('a/b/c/d','+/b/#')).toBe(true);
  expect(topicQualifier('a/b/c/d','+/b/#',true)?.join('|')).toBe('a|c/d');

  expect(topicQualifier('a/b/c','x/b/c')).toBe(false);
  expect(topicQualifier('a/b/c','a/x/c')).toBe(false);
  expect(topicQualifier('a/b/c','a/b/x')).toBe(false);
});

test('Interest operator (single topic)', () => {
  const tests: string[] = [];
  const topic = 'a/b/5';
  const msg$ = new Subject<IMsg>();
  const $ = msg$.pipe(interest(
    topic,
    { next(topics){ tests.push(`subscribed to ${topics}`) } },
    { next(topics){ tests.push(`unsubscribed from ${topics}`) } },
  ));

  expect(tests.length).toBe(0);
  const sub = $.subscribe(({payload}) => tests.push(`received: ${payload.toString()}`));
  expect(tests.length).toBe(1);
  for (let i=0; i<9; i++) msg$.next({topic:`a/b/${i}`,payload:Buffer.from(`test ${i}`, "utf-8")} as any);
  expect(tests.length).toBe(2);
  sub.unsubscribe();
  expect(tests.length).toBe(3);

  expect(tests[0]).toBe('subscribed to a/b/5');
  expect(tests[1]).toBe('received: test 5');
  expect(tests[2]).toBe('unsubscribed from a/b/5');
})


test('Interest operator (multiple topics)', () => {
  const tests: string[] = [];
  const topic = ['a/b/7','a/b/3'];
  const msg$ = new Subject<IMsg>();
  const $ = msg$.pipe(interest(
    topic,
    { next(topics){ tests.push(`subscribed to ${topics.length} topics`) } },
    { next(topics){ tests.push(`unsubscribed ${topics.length} topics`) } },
  ));

  expect(tests.length).toBe(0);
  const sub = $.subscribe(({payload}) => tests.push(`received: ${payload.toString()}`));
  expect(tests.length).toBe(1);
  for (let i=0; i<9; i++) msg$.next({topic:`a/b/${i}`,payload:Buffer.from(`test ${i}`, "utf-8")} as any);
  expect(tests.length).toBe(3);
  sub.unsubscribe();
  expect(tests.length).toBe(4);

  expect(tests[0]).toBe('subscribed to 2 topics');
  expect(tests[1]).toBe('received: test 3');
  expect(tests[2]).toBe('received: test 7');
  expect(tests[3]).toBe('unsubscribed 2 topics');
})

test('Interest operator (single topic matches)', () => {
  const tests: string[] = [];
  const topic = 'a/+/c/+/e/#';
  const msg$ = new Subject<IMsg>();
  const $ = msg$.pipe(matches(topic, { next(topics){} }, { next(topics){} }));

  const sub = $.subscribe(({match}) => tests.push(`match: ${match?.join(',')}`));
  msg$.next({topic:'a/b/c/d/e/f/g'} as any);
  sub.unsubscribe();

  expect(tests.length).toBe(1);
  expect(tests[0]).toBe('match: b,d,f/g');
})

test('Interest operator (multi topic matches)', () => {
  const tests: string[] = [];
  const topic = ['a/+/c/+/e/#','a/b/+/d/+/f/g'];
  const msg$ = new Subject<IMsg>();
  const $ = msg$.pipe(matches(topic, { next(topics){} }, { next(topics){} }));

  expect(tests.length).toBe(0);
  const sub = $.subscribe(({match}) => {
    tests.push(`match: ${match[0][1]?.join(',')}`);
    tests.push(`match: ${match[1][1]?.join(',')}`);
  });
  msg$.next({topic:'a/b/c/d/e/f/g'} as any);
  sub.unsubscribe();

  expect(tests.length).toBe(2);
  expect(tests[0]).toBe('match: b,d,f/g');
  expect(tests[1]).toBe('match: c,e');
})

test('Interest operator with callback', () => {
  const tests: string[] = [];
  const topic = ['a/b/7','a/b/3'];
  const msg$ = new Subject<IMsg>();
  const $ = msg$.pipe(interest(
    topic,
    { next(topics){ tests.push(`subscribed to ${topics.length} topics`) } },
    { next(topics){ tests.push(`unsubscribed from ${topics.length} topics`) } },
    ({payload}) => tests.push(`received: ${payload.toString()}`),
  ));

  expect(tests.length).toBe(0);
  const sub = $.subscribe(({payload}) => tests.push(`ignored: ${payload.toString()}`));
  expect(tests.length).toBe(1);
  for (let i=2; i<5; i++) msg$.next({topic:`a/b/${i}`,payload:Buffer.from(`test ${i}`, "utf-8")} as any);
  expect(tests.length).toBe(4);
  sub.unsubscribe();
  expect(tests.length).toBe(5);

  expect(tests[0]).toBe('subscribed to 2 topics');
  expect(tests[1]).toBe('ignored: test 2');
  expect(tests[2]).toBe('received: test 3');
  expect(tests[3]).toBe('ignored: test 4');
  expect(tests[4]).toBe('unsubscribed from 2 topics');
})

test('Interest operator with callback (matches)', () => {
  const tests: string[] = [];
  const topic = ['+/3/+'];
  const msg$ = new Subject<IMsg>();
  const $ = msg$.pipe(matches(
    topic,
    { next(topics){ tests.push(`subscribed to ${topics.length} topic`) } },
    { next(topics){ tests.push(`unsubscribed from ${topics.length} topic`) } },
    ({match}) => tests.push(`match: ${match[0][1]?.join(',')}`),
  ));

  expect(tests.length).toBe(0);
  const sub = $.subscribe(({payload}) => tests.push(`ignored: ${payload.toString()}`));
  expect(tests.length).toBe(1);
  for (let i=2; i<5; i++) msg$.next({topic:`${i}/${i}/${i}`,payload:Buffer.from(`test ${i}`, "utf-8")} as any);
  expect(tests.length).toBe(4);
  sub.unsubscribe();
  expect(tests.length).toBe(5);

  expect(tests[0]).toBe('subscribed to 1 topic');
  expect(tests[1]).toBe('ignored: test 2');
  expect(tests[2]).toBe('match: 3,3');
  expect(tests[3]).toBe('ignored: test 4');
  expect(tests[4]).toBe('unsubscribed from 1 topic');
})