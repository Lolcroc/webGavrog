'use strict';

var I = require('immutable');


var _apply = function _apply(x, f) {
  return f(x);
};


var _joiningPathPair = function _joiningPathPair(s, t, eOut, eIn) {
  if (s == t)
    return I.fromJS([[],[]]);

  var qs = I.List([s]);
  var qt = I.List([t]);
  var seenFrom = I.Map([[s, s], [t, t]]);
  var backEdge = I.Map();

  var _step = function _step(queue, thisStart, otherStart) {
    var v = queue.first();
    queue = queue.rest();

    var next = eOut.get(v);

    if (next) {
      var e = next.find(function(e) {
        return seenFrom.get(e.get(1)) == otherStart;
      });

      if (e)
        return { bridge: e };
      else
        next
        .filter(function(e) { return !seenFrom.get(e.get(1)); })
        .forEach(function(e) {
          var v = e.get(1);
          queue = queue.push(v);
          seenFrom = seenFrom.set(v, thisStart);
          backEdge = backEdge.set(v, e);
        });
    }

    return { queue: queue };
  };

  var _trace = function _trace(v) {
    return I.List().withMutations(function(list) {
      while (backEdge.get(v)) {
        var e = backEdge.get(v);
        list.unshift(e.get(2));
        v = e.get(0);
      }
    });
  };

  var _tracePaths = function _tracePaths(bridge) {
    return I.List([_trace(bridge.get(0)).push(bridge.get(2)),
                   _trace(bridge.get(1))]);
  };

  var tmp;

  while (!(qs.isEmpty() && qt.isEmpty())) {
    if (!qs.isEmpty()) {
      tmp = _step(qs, s, t);
      if (tmp.bridge)
        return _tracePaths(tmp.bridge);
      else
        qs = tmp.queue;
    }
    if (!qt.isEmpty()) {
      tmp = _step(qt, t, s);
      if (tmp.bridge)
        return _tracePaths(tmp.bridge).reverse();
      else
        qt = tmp.queue;
    }
  }
};


var _coercionPathPairs = function _coercionPathPairs(upcasts) {
  var _outEdges = upcasts.groupBy(function(e) { return e.get(0); });
  var _inEdges = upcasts.groupBy(function(e) { return e.get(1); });
  var _types = I.Set(_outEdges.keySeq().concat(_inEdges.keySeq()));

  return I.Map(_types.map(function(s) {
    return [s, I.Map(_types.map(function(t) {
      return [t, _joiningPathPair(s, t, _outEdges, _inEdges)];
    }))];
  }));
};


var number = function number(promote, types, upcasts, downcasts) {
  var _methods = I.Map(types.map(function(t) {
    return [t.type, t];
  }));
  var _coercionMatrix = _coercionPathPairs(I.fromJS(upcasts));
  var _downcasts = I.Map(I.fromJS(downcasts).toJS());

  var _num = function _num(n) {
    if (!!n && n.type)
      return n;
    else
      return promote(n);
  };

  var _coerce = function _coerce(a, b) {
    a = _num(a);
    b = _num(b);

    if (a.type == b.type)
      return [a, b];
    else {
      var paths = _coercionMatrix.getIn([a.type, b.type]);
      return [paths.get(0).reduce(_apply, a), paths.get(1).reduce(_apply, b)];
    }
  };

  var _downcast = function _downcast(n) {
    var f = _downcasts.get(n.type);
    if (!f)
      return n;
    else {
      var val = f(n);
      return val.type == n.type ? val : _downcast(val);
    }
  };

  var _property = function _property(name) {
    return function f(n) {
      n = _num(n);
      return _methods.get(n.type)[name](n);
    };
  };

  var _unary = function _unary(name) {
    var _f = _property(name);
    return function f(n) {
      return _downcast(_f(n));
    };
  };

  var _relation = function _unary(name) {
    return function f(a, b) {
      var t = _coerce(a, b);
      return _methods.get(t[0].type)[name](t[0], t[1]);
    };
  };

  var _binary = function _unary(name) {
    var _f = _relation(name);
    return function f(a, b) {
      return _downcast(_f(a, b));
    };
  };

  var toString = _property('toString');
  var sgn      = _property('sgn');
  var isEven   = _property('isEven');

  var negative = _unary('negative');
  var abs      = _unary('abs');

  var cmp      = _relation('cmp');

  var plus     = _binary('plus');
  var minus    = _binary('minus');
  var times    = _binary('times');
  var idiv     = _binary('idiv');
  var mod      = _binary('mod');

  return {
    toString: toString,
    sgn     : sgn,
    isEven  : isEven,
    negative: negative,
    abs     : abs,
    cmp     : cmp,
    plus    : plus,
    minus   : minus,
    times   : times,
    idiv    : idiv,
    mod     : mod
  };
};


if (require.main == module) {
  var makeType = function(name) {
    var out = {
      make: function(val) { return { type: name, value: val }; },
      type: name
    };

    [
      'toString', 'sgn', 'isEven', 'negative', 'abs',
      'cmp', 'plus', 'minus', 'times', 'idiv', 'mod'
    ]
      .forEach(function(s) {
        out[s] = function() {
          return ''+s+'('+
            [].slice.apply(arguments).map(JSON.stringify).join(', ')+')';
        };
      });

    return out;
  }

  var AtoB = function AtoB(x) {
    return B.make(x);
  };

  var BtoD = function BtoD(x) {
    return D.make(x);
  };

  var CtoD = function CtoD(x) {
    return D.make(x);
  };

  var A = makeType('A');
  var B = makeType('B');
  var C = makeType('C');
  var D = makeType('D');

  var num = number(
    null, // promote
    [A, B, C, D], // types
    [[A.type, B.type, AtoB],
     [C.type, D.type, CtoD],
     [B.type, D.type, BtoD]], //upcasts
    [] // downcasts
  );

  console.log(num.plus(A.make(5), C.make(2)));

  var longInt = require('./longInt');
  var checkedInt = require('./checkedInt');

  num = number(
    checkedInt.promote,
    [checkedInt, longInt],
    [[checkedInt.type, longInt.type, function(n) {
      return longInt.promote(checkedInt.asJSNumber(n));
    }]],
    [[longInt.type, function(n) {
      var val = longInt.asJSNumber(n);
      if (val !== undefined)
        return checkedInt.promote(val);
      else
        return n;
    }]]
  );

  var t = checkedInt.promote(1);
  for (var i = 1; i < 50; ++i)
    t = num.times(t, checkedInt.promote(i));
  console.log(num.toString(t));
  for (var i = 1; i < 50; ++i)
    t = num.idiv(t, checkedInt.promote(i));
  console.log(t);
}
