/**
 * This file is part of spy4js which is released under MIT license.
 *
 * The LICENSE file can be found in the root directory of this project.
 *
 */

import React, { Component, Fragment } from 'react';
import { Serializer } from '../src';

describe('serialize', () => {
    it('serializes primitives', () => {
        expect(Serializer.run(undefined)).toBe('undefined');
        expect(Serializer.run(null)).toBe('null');
        expect(Serializer.run('test')).toBe("'test'");
        expect(Serializer.run(12)).toBe('12');
        expect(Serializer.run(BigInt(13))).toBe('13n');
        expect(Serializer.run(true)).toBe('true');
        expect(Serializer.run(/^abc$/)).toBe('//^abc$//');
        expect(Serializer.run(Symbol.for('test'))).toBe("Symbol.for('test')");
        expect(Serializer.run(Symbol('test'))).toBe('Symbol(test)'); // <- this one is a special case since it will never match because a unique symbol was used
        expect(Serializer.run(() => undefined)).toBe('Function');
        const FooFunction = () => undefined;
        expect(Serializer.run(FooFunction)).toBe('FooFunction');
        expect(Serializer.run(async () => undefined)).toBe('AsyncFunction');
        const BarFunction = async () => undefined;
        expect(Serializer.run(BarFunction)).toBe('BarFunction');
        expect(Serializer.run(new Error('foo'))).toBe("new Error('foo')");
        const date = new Date(1531052672662);
        expect(Serializer.run(date)).toBe('new Date(1531052672662)');
        expect(Serializer.run(new Set(['foo', 'bar']))).toBe("new Set(['foo', 'bar'])");
        expect(
            Serializer.run(
                new Map<string, any>([
                    ['foo', 'bar'],
                    ['blub', 3],
                ])
            )
        ).toBe("new Map([['foo', 'bar'], ['blub', 3]])");
    });

    it('escapes single quotes', () => {
        expect(Serializer.run("here's that 'stuff'")).toBe(`"here's that 'stuff'"`);
        expect(Serializer.run("here's \"that\" 'stuff'")).toBe("'here's \"that\" 'stuff''");
    });

    it('serializes arrays', () => {
        expect(Serializer.run([])).toBe('[]');
        expect(Serializer.run([1, 'test', /^abc$/])).toBe("[1, 'test', //^abc$//]");
    });
    it('serializes class instances as objects with different name as prefix', () => {
        class Clazz {
            _prop: number;
            constructor(prop: number) {
                this._prop = prop;
            }
        }
        class Other {
            _attr: Clazz;
            _other: string;

            constructor(prop: number, other: string) {
                this._attr = new Clazz(prop);
                this._other = other;
            }
        }
        const inst = new Clazz(12);
        const inst2 = new Other(42, 'test');
        expect(Serializer.run(inst)).toBe('Clazz{_prop: 12}');
        expect(Serializer.run(inst2)).toBe("Other{_attr: Clazz{_prop: 42}, _other: 'test'}");
    });
    it('serializes objects', () => {
        expect(Serializer.run({})).toBe('{}');
        expect(Serializer.run({ prop1: 12, prop2: 'test' })).toBe("{prop1: 12, prop2: 'test'}");
    });
    it('serializes cyclomatic structures', () => {
        const o: any = { prop1: 'test', prop2: { prop21: 12 } };
        o.prop3 = o;
        o.prop2.prop22 = o;
        expect(Serializer.run(o)).toBe(
            "{prop1: 'test', prop2: {prop21: 12, prop22: >CYCLOMATIC<}, prop3: >CYCLOMATIC<}"
        );
    });
    it('serializes non cyclomatic structures but repeating elements', () => {
        const a = { some: 'prop' };
        const o: any = { prop1: 'test', prop2: { prop21: 12 } };
        o.prop3 = a;
        o.prop2.prop22 = a;
        expect(Serializer.run(o)).toBe(
            "{prop1: 'test', prop2: {prop21: 12, prop22: {some: 'prop'}}, prop3: {some: 'prop'}}"
        );
    });
    it('serializes custom definitions', () => {
        const theVerySpecial = { very: 'special' };
        const custom = (o: any): string | void => {
            if (o === theVerySpecial) return '>>SPECIAL<<';
        };
        const customSerializer = Serializer.create(custom);
        const o: any = { prop1: 'test', prop2: theVerySpecial };
        expect(customSerializer(o)).toBe("{prop1: 'test', prop2: >>SPECIAL<<}");
    });
    it('serializes all together', () => {
        const o: any = { prop1: 'test', prop2: { prop21: 12 } };
        o.prop3 = o;
        o.prop2.prop22 = o;
        class Clazz {
            _prop: number;
            constructor(prop: number) {
                this._prop = prop;
            }
        }
        const inst = new Clazz(12);
        o.prop4 = [1, 3, inst, { attr: new Date(1531034204627), attr2: Symbol.for('test') }];

        expect(Serializer.run(o)).toBe(
            "{prop1: 'test', " +
                'prop2: {prop21: 12, prop22: >CYCLOMATIC<}, ' +
                'prop3: >CYCLOMATIC<, ' +
                "prop4: [1, 3, Clazz{_prop: 12}, {attr: new Date(1531034204627), attr2: Symbol.for('test')}]}"
        );
    });

    it('serializes simple jsx', () => {
        const clickHandler = () => undefined;
        const o = (
            <div className="test" key="test-key">
                <p style={{ background: 'red' }}>Some text for the test</p>
                <button onClick={clickHandler}>Click here</button>
            </div>
        );

        expect(Serializer.run(o)).toBe(
            '<div className="test" key="test-key">' +
                "<p style={{background: 'red'}}>Some text for the test</p>" +
                '<button onClick={clickHandler}>Click here</button></div>'
        );
    });

    it('serializes react components', () => {
        class TestComponent extends Component<{
            str: string;
            bool: boolean;
            children?: React.ReactNode;
        }> {
            render() {
                return <div className={this.props.str}>{String(this.props.bool)}</div>;
            }
        }
        const o = (
            <TestComponent str="test" bool key="test-key" ref="test-ref" /> // eslint-disable-line
        );
        const o2 = (
            <TestComponent str="test" bool key="test-key">
                <div className="foo">Inner text</div>
            </TestComponent>
        );

        expect(Serializer.run(o)).toBe('<TestComponent str="test" bool={true} key="test-key" ref="test-ref" />');

        expect(Serializer.run(o2)).toBe(
            '<TestComponent str="test" bool={true} key="test-key"><div className="foo">Inner text</div></TestComponent>'
        );
    });

    it('serializes react functional components', () => {
        const TestComponent = (props: any) => <div className={props.str}>{String(props.bool)}</div>;
        const newRefApiRef = React.createRef();
        const o = <TestComponent str="test" bool key="test-key" ref={newRefApiRef} />;

        expect(Serializer.run(o)).toBe('<TestComponent str="test" bool={true} key="test-key" ref={{current: null}} />');
    });

    it('serializes react fragment', () => {
        const o = (
            <Fragment key="foo">
                <div>Test that</div>
            </Fragment>
        );

        expect(Serializer.run(o)).toBe('<Fragment key="foo"><div>Test that</div></Fragment>');
    });

    it('serializes fallbacks for failing react serialization', () => {
        expect(Serializer.run({ $$typeof: Symbol.for('foo') })).toBe(
            "{$$typeof: Symbol.for('foo')}" // unknown symbol for the $$typeof attribute
        );
        expect(Serializer.run({ $$typeof: Symbol.for('react.special') })).toBe(
            "{$$typeof: Symbol.for('react.special')}" // unknown symbol for the $$typeof attribute, which starts with 'react.'
        );
        expect(
            Serializer.run({
                $$typeof: Symbol.for('react.element'),
                type: Symbol.for('foo'), // unknown symbol as type
                props: {},
            })
        ).toBe('<UNKNOWN />');
        expect(
            Serializer.run({
                $$typeof: Symbol.for('react.element'),
                type: 1234, // unknown type for field type
                props: {},
            })
        ).toBe('<UNKNOWN />');
    });

    it('serializes objects with different key order equally', () => {
        expect(Serializer.run({ foo: 'bar', isIt: true })).toBe(Serializer.run({ isIt: true, foo: 'bar' }));
    });

    it('serializes maps/sets inside maps/sets', () => {
        expect(
            Serializer.run(
                new Set([
                    new Map<string, any>([
                        ['foo', 'bar'],
                        ['blub', 3],
                    ]),
                    'bar',
                ])
            )
        ).toBe("new Set([new Map([['foo', 'bar'], ['blub', 3]]), 'bar'])");
        expect(
            Serializer.run(
                new Map<string, any>([
                    ['foo', 'bar'],
                    ['blub', new Set([2, 3])],
                ])
            )
        ).toBe("new Map([['foo', 'bar'], ['blub', new Set([2, 3])]])");
    });

    it('serializes maps/sets with duplicated keys/entries', () => {
        expect(
            Serializer.run(
                new Map<string, any>([
                    ['foo', 'bar'],
                    ['foo', 3],
                ])
            )
        ).toBe("new Map([['foo', 3]])");
        expect(Serializer.run(new Set([3, 3]))).toBe('new Set([3])');
    });

    it('serializes HTML elements', () => {
        expect(Serializer.run(document.body)).toBe('HTMLBodyElement');

        const div = document.createElement('div');
        const span = document.createElement('span');

        expect(Serializer.run([div, span])).toBe('[HTMLDivElement, HTMLSpanElement]');
    });

    it('serializes window & document', () => {
        expect(Serializer.run(window)).toBe('window');
        expect(Serializer.run(document)).toBe('document');
    });

    it('serializes a self expanding Proxy', () => {
        // code that caused the error
        const proxyTarget = {};
        const _dotPrefix = (name: string, prefix = ''): string => (prefix && prefix + '.') + name;
        const _createFieldNameProxy = (proxyTarget: any, prefix = ''): any =>
            new Proxy(proxyTarget, {
                get(target, prop) {
                    if (prop === 'toString' || typeof prop === 'symbol') return () => prefix;
                    // let the target grow with that property
                    if (!target[prop]) target[prop] = _createFieldNameProxy(_dotPrefix(prop, prefix));
                    return target[prop];
                },
            });

        // It is not possible in JS to obtain if a given object is a Proxy or
        // not so the best serialization possible is just the proxy target object
        expect(Serializer.run(_createFieldNameProxy(proxyTarget))).toBe('{}');
    });
});
