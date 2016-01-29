import * as I from 'immutable';


export default function fraction(intType, promoteToInt, timers = null) {

  const Fraction = I.Record({
    numer: undefined,
    denom: undefined
  });


  Fraction.prototype.toString = function toString() {
    const n = asInteger(this);
    if (n !== undefined)
      return n.toString();
    else
      return this.numer.toString() + '/' + this.denom.toString();
  };


  const make = (numer, denom) => new Fraction({ numer, denom });
  const toJS = n => intType.toJS(n.numer) / intType.toJS(n.denom);


  const gcd = function gcd(a, b) {
    timers && timers.start("computing gcd");
    a = intType.abs(a);
    b = intType.abs(b);

    timers && timers.start("gcd loop");
    while (intType.sgn(b) > 0)
      [a, b] = [b, intType.mod(a, b)];
    timers && timers.stop("gcd loop");

    timers && timers.stop("computing gcd");
    return a;
  };


  const normalized = function normalized(n, d = promoteToInt(1)) {
    let result;

    timers && timers.start("normalizing");

    if (intType.sgn(n) == 0) {
      result = make(n, promoteToInt(1));
    }
    else {
      const s = intType.sgn(d);

      if (s == 0)
        throw new Error('fraction has zero denominator');
      else if (s < 0)
        result = normalized(intType.negative(n), intType.negative(d));
      else {
        const a = gcd(n, d);
        result = make(intType.idiv(n, a), intType.idiv(d, a));
      }
    }

    timers && timers.stop("normalizing");

    return result;
  };


  const asInteger = function asInteger(q) {
    if (intType.cmp(q.denom, promoteToInt(1)) == 0)
      return q.numer;
  };


  const negative = q => make(intType.negative(q.numer), q.denom);
  const abs      = q => make(intType.abs(q.numer), q.denom);
  const sgn      = q => intType.sgn(q.numer);


  const isEven = function isEven(q) {
    const n = asInteger(q);
    return n !== undefined && intType.isEven(n);
  };


  const cmp = (q, r) => sgn(minus(q, r));


  const plus = function plus(q, r) {
    const a = gcd(q.denom, r.denom);
    const s = intType.idiv(r.denom, a);
    const t = intType.idiv(q.denom, a);

    return normalized(intType.plus(intType.times(s, q.numer),
                                   intType.times(t, r.numer)),
                      intType.times(s, q.denom));
  };


  const minus = (q, r) => plus(q, negative(r));


  const times = function times(q, r) {
    const a = gcd(q.numer, r.denom);
    const b = gcd(q.denom, r.numer);

    return normalized(intType.times(intType.idiv(q.numer, a),
                                    intType.idiv(r.numer, b)),
                      intType.times(intType.idiv(q.denom, b),
                                    intType.idiv(r.denom, a)));
  };


  const inverse = q => normalized(q.denom, q.numer);

  const div = (q, r) => times(q, inverse(r));

  const idiv = function idiv(q, r) {
    const t = div(q, r);
    return intType.idiv(t.numer, t.denom);
  };


  const mod = (a, b) => minus(a, times(normalized(idiv(a, b)), b));


  return {
    type: Fraction,
    promote: normalized,
    toJS,
    asInteger,
    negative,
    abs,
    sgn,
    isEven,
    cmp,
    plus,
    minus,
    times,
    inverse,
    div,
    idiv,
    mod
  };
};


if (require.main == module) {
  const util = require('../common/util');
  const timer = util.timer();
  const timers = util.timers();

  const longInt = require('./longInt').default(4);
  const integer = longInt;

  const {
    promote,
    negative, abs, sgn, isEven, cmp, plus, minus, times, div, idiv, mod
  } = fraction(integer, integer.promote, timers);

  const q = (n, d = 1) => promote(integer.promote(n), integer.promote(d));

  console.log(q(-1234));
  console.log(q(2, 3));
  console.log(q(-1234, -26));
  console.log(q(111111, 185));
  console.log(times(q(9, 10), q(5, 21)));
  console.log(minus(q(3, 5), q(7, 11)));
  console.log(div(q(111111111), q(2 * 12345679)));
  console.log(plus(q(1, 2), q(1, 2)));
  console.log(plus(q(2, 3), q(4, 3)));
  console.log(plus(q(2, 3), q(1)));
  console.log(div(q(2, 3), q(2)));
  console.log(plus(q(2, 3), q(-2, 3)));
  console.log(idiv(q(2, 5), q(1, 7)));
  console.log(mod(q(2, 5), q(1, 7)));

  console.log(`Computation time was ${timer()} msec.`);
  console.log(`Details: ${JSON.stringify(timers.current(), null, 2)}`);
}
