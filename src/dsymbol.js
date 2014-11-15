'use strict';

var I = require('immutable');


var isElement = function isElement(dsImpl, D) {
  return typeof D == 'number' && D >= 1 && D <= dsImpl.size;
};

var elements = function elements(dsImpl) {
  return I.Range(1, dsImpl.size+1);
};

var isIndex = function isIndex(dsImpl, i) {
  return typeof i == 'number' && i >= 0 && i <= dsImpl.dim;
};

var indices = function indices(dsImpl) {
  return I.Range(0, dsImpl.dim+1);
};

var get = function offset(dsImpl, list, i, D) {
  return list.get(i * dsImpl.size + D - 1);
};

var s = function s(dsImpl, i, D) {
  if (isElement(dsImpl, D) && isIndex(dsImpl, i))
    return get(dsImpl, dsImpl.s, i, D);
};

var v = function v(dsImpl, i, j, D) {
  if (isElement(dsImpl, D) && isIndex(dsImpl, i) && isIndex(dsImpl, j)) {
    if (j == i+1)
      return get(dsImpl, dsImpl.v, i, D);
    else if (j == i-1)
      return get(dsImpl, dsImpl.v, j, D);
    else if (get(dsImpl, dsImpl.s, i, D) == get(dsImpl, dsImpl.s, j, D))
      return 2;
    else
      return 1;
  }
};


var fromData = function fromData(dim, sData, vData) {
  var _s = I.List(sData);
  var _v = I.List(vData);

  var _ds = {
    s   : _s,
    v   : _v,
    dim : dim,
    size: _v.size / dim
  };

  return {
    isElement: function(D)       { return isElement(_ds, D); },
    elements : function()        { return elements(_ds); },
    isIndex  : function(i)       { return isIndex(_ds, i); },
    indices  : function()        { return indices(_ds); },
    s        : function(i, D)    { return s(_ds, i, D); },
    v        : function(i, j, D) { return v(_ds, i, j, D); },
    toString : function()        { return toString(this); }
  }
};


var parseInts = function parseNumbers(str) {
  return str.trim().split(/\s+/).map(function(s) { return parseInt(s); });
};


var fromString = function fromString(str) {
  var parts = str.trim().replace(/^</, '').replace(/>$/, '').split(/:/);
  if (parts[0].match(/\d+\.\d+/))
    parts.shift();

  var dims = parseInts(parts[0]);
  var size = dims[0];
  var dim  = dims[1] || 2;

  var gluings = parts[1].split(/,/).map(parseInts);
  var degrees = parts[2].split(/,/).map(parseInts);

  var s = new Array((dim+1) * size);
  var v = new Array(dim * size);

  var get = function get(a, i, D) { return a[i * size + D - 1]; };
  var set = function get(a, i, D, x) { a[i * size + D - 1] = x; };

  for (var i = 0; i <= dim; ++i) {
    var k = -1;
    for (var D = 1; D <= size; ++D) {
      if (!get(s, i, D)) {
        var E = gluings[i][++k];
        set(s, i, D, E);
        set(s, i, E, D);
      }
    }
  }

  for (var i = 0; i < dim; ++i) {
    var k = -1;
    for (var D = 1; D <= size; ++D) {
      if (!get(v, i, D)) {
        var m = degrees[i][++k];
        var E = D;
        var r = 0;

        do {
          E = get(s, i, E) || E;
          E = get(s, i+1, E) || E;
          ++r;
        }
        while (E != D);

        var b = m / r;

        do {
          E = get(s, i, E) || E;
          set(v, i, E, b);
          E = get(s, i+1, E) || E;
          set(v, i, E, b);
        }
        while (E != D);
      }
    }
  }

  return fromData(dim, s, v);
};


var toString = function toString(ds) {
  var d = ds.indices().size - 1;
  var n = ds.elements().size;

  var sDefs = ds.indices()
    .map(function(i) {
      var seen = new Array(n);
      var imgs = [];
      ds.elements().forEach(function(D) {
        if (!seen[D]) {
          var E = ds.s(i, D);
          seen[E] = seen[D] = true;
          imgs.push(E);
        }
      });
      return imgs;
    })
    .map(function(a) { return a.join(' '); }).join(',');

  var mDefs = ds.indices()
    .filter(function(i) { return ds.isIndex(i+1); })
    .map(function(i) {
      var seen = new Array(n);
      var vals = [];
      ds.elements().forEach(function(D) {
        if (!seen[D]) {
          var r = 0;
          var E = D;
          do {
            E = ds.s(i, E) || E;
            seen[E] = true;
            E = ds.s(i+1, E) || E;
            seen[E] = true;
            r++;
          }
          while (E != D);
          vals.push(r * ds.v(i, i+1, D));
        }
      });
      return vals;
    })
    .map(function(a) { return a.join(' '); }).join(',');

  return '<1.1:'+n+(d == 2 ? '' : ' '+d)+':'+sDefs+':'+mDefs+'>';
};


module.exports = {
  fromData  : fromData,
  fromString: fromString
};


if (require.main == module)
  console.log('' + fromString('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
