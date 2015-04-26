'use strict';

var I = require('immutable');
var fw = require('./freeWords');


var _relatorsByStartGen = function _relatorsByStartGen(relators) {
  return I.List(relators).map(I.List)
    .flatMap(function(w) {
      return I.Range(0, w.size).flatMap(function(i) {
        var wx = fw.product([w.slice(i), w.slice(0, i)]);
        return [wx, fw.inverse(wx)];
      });
    })
    .groupBy(function(rel) { return rel.get(0); })
    .map(I.Set);
};


var Edge = I.Record({
  point: undefined,
  gen  : undefined
});


var _inverseEdge = function _inverseEdge(edge, action) {
  return new Edge({
    point: action(edge.point, edge.gen),
    gen  : fw.inverse([edge.gen]).first()
  });
};


var _closeRelations = function _closeRelations(
  startEdge,
  edge2word,
  relsByGen,
  action
) {
  var queue = I.List([startEdge]);

  while (!queue.isEmpty()) {
    var next = queue.first();
    queue = queue.rest();

    console.log('next = '+next);

    var p = next.point;
    var g = next.gen;

    relsByGen.get(g).forEach(function(r) {
      console.log('  r = '+r);

      var x = p;
      var cuts = I.List();
      r.forEach(function(h, i) {
        var next = new Edge({ point: x, gen: h });
        if (edge2word.get(next) == null)
          cuts = cuts.push([i, next]);
        x = action(x, h);
      });
      console.log('  cuts = '+cuts);

      if (cuts.size == 1) {
        var i = cuts.first()[0];
        var cut = cuts.first()[1];
        var x = cut.point;
        var g = cut.gen;
        var wx = fw.inverse(fw.product([r.slice(i), r.slice(0, i)]));

        var trace = fw.empty;
        wx.forEach(function(h) {
          var t = edge2word.get(new Edge({ point: x, gen: h }));
          trace = fw.product(trace, t);
          x = action(x, h);
        });

        edge2word = edge2word
          .set(cut, trace)
          .set(_inverseEdge(cut, action), fw.inverse(trace));

        queue = queue.push(cut);
      }
    });
  }

  return edge2word;
};


var _spanningTree = function _spanningTree(basePoint, nrGens, action) {
  var queue = I.List([basePoint]);
  var seen = I.Set([basePoint]);
  var gens = I.Range(1, nrGens+1).flatMap(function(i) { return [i, -i]; });
  var edges = I.List();

  while (!queue.isEmpty()) {
    var point = queue.first();
    queue = queue.rest();

    gens.forEach(function(g) {
      var p = action(point, g);
      if (!seen.contains(p)) {
        queue = queue.push(p);
        seen = seen.add(p);
        edges = edges.push(new Edge({ point: point, gen: g }));
      }
    });
  }

  return edges;
};


if (require.main == module) {
  var rels = [[1,1], [2,2], [3,3],
              [1,2,1,2,1,2], [1,3,1,3], fw.raisedTo(3, [2,3])];
  var relsByGen = _relatorsByStartGen(rels);
  console.log(relsByGen);

  relsByGen = _relatorsByStartGen([[1,1],[2,2],[1,2,1,2]]);
  var start = new Edge({ point: 'a', gen: 1 });
  var actionAsMap = I.Map({
    a: I.Map([[1, 'b'], [2, 'c'], [-1, 'b'], [-2, 'c']]),
    b: I.Map([[1, 'a'], [2, 'd'], [-1, 'a'], [-2, 'd']]),
    c: I.Map([[1, 'd'], [2, 'a'], [-1, 'd'], [-2, 'a']]),
    d: I.Map([[1, 'c'], [2, 'b'], [-1, 'c'], [-2, 'b']]),
  });

  var action = function action(point, gen) {
    return actionAsMap.getIn([point, gen]);
  };

  console.log(_spanningTree('a', 2, action));

  var edge2word = I.Map([
    [new Edge({ point: 'a', gen:  1 }), fw.empty],
    [new Edge({ point: 'b', gen: -1 }), fw.empty],
    [new Edge({ point: 'b', gen:  2 }), fw.empty],
    [new Edge({ point: 'd', gen: -2 }), fw.empty],
    [new Edge({ point: 'd', gen:  1 }), fw.empty],
    [new Edge({ point: 'c', gen: -1 }), fw.empty]
  ]);
  console.log(_closeRelations(start, edge2word, relsByGen, action));
}
