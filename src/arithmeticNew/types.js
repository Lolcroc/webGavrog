const a = require('./base').arithmetic()

a.register(require('./integers').methods());

export const integers = a.ops();

a.register(require('./fractions').methods(
  integers, ['Integer', 'LongInt'], 'Fraction'
));

export const rationals = a.ops();


const realMethods = {
  toJS    : [ { argtypes: ['Float'], method: x => x  } ],
  negative: [ { argtypes: ['Float'], method: x => -x } ],
  abs     : [ { argtypes: ['Float'], method: x => Math.abs(x) } ],
  sgn     : [ { argtypes: ['Float'], method: x => (x > 0) - (x < 0) } ],
  floor   : [ { argtypes: ['Float'], method: x => Math.floor(x) } ],
  ceil    : [ { argtypes: ['Float'], method: x => Math.ceil(x) } ]
};

for (const [op, name] of [
  [(x, y) => (x > y) - (x < y), 'cmp'  ],
  [(x, y) => x + y            , 'plus' ],
  [(x, y) => x - y            , 'minus'],
  [(x, y) => x * y            , 'times'],
  [(x, y) => x / y            , 'div'  ]
]) {
  realMethods[name] = [ { argtypes: ['Float', 'Float'], method: op } ];

  for (const ratType of ['Integer', 'LongInt', 'Fraction']) {
    realMethods[name].push({
      argtypes: ['Float', ratType], method: (x, y) => op(x, rationals.toJS(y))
    });
    realMethods[name].push({
      argtypes: [ratType, 'Float'], method: (x, y) => op(rationals.toJS(x), y)
    });
  }
}

a.register(realMethods);

export const reals = a.ops();


if (require.main == module) {
  console.log(`${reals.div(2,3)}`);
  console.log(`${reals.plus(reals.div(2,3), 0.1)}`);
}
