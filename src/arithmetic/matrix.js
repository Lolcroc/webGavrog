'use strict';

var I = require('immutable');


var matrix = function matrix(scalar, zero, one) {

  var Matrix = I.Record({
    nrows: undefined,
    ncols: undefined,
    data : undefined
  });

  Matrix.prototype.toString = function() {
    return '<'+this.nrows+'x'+this.ncols+' matrix: '+this.data+'>'
  };

  var get = function get(A, i, j) {
    return A.data.getIn([i, j]);
  };

  var _make = function _make(data) {
    if (data.size == 0 || data.first().size == 0)
      throw new Error('both dimensions must be positive');

    return new Matrix({
      nrows: data.size,
      ncols: data.first().size,
      data : I.List(data.map(I.List))
    });
  };

  var make = function make(data) {
    var tmp = I.List(data.map(I.List));
    var m = tmp.map(function(row) { return row.size; }).max();
    return _make(tmp.map(function(row) {
      return row.concat(I.Repeat(zero, m - row.size));
    }));
  };

  var constant = function constant(nrows, ncols, value) {
    var x = value === undefined ? zero : value;
    return _make(I.List(I.Repeat(I.List(I.Repeat(x, ncols)), nrows)));
  };

  var identity = function identity(n) {
    var zrow = I.List(I.Repeat(zero, n));
    return _make(I.Range(0, n).map(function(i) { return zrow.set(i, one); }));
  };

  var transposed = function transposed(A) {
    return _make(I.Range(0, A.ncols).map(function(j) {
      return I.Range(0, A.nrows).map(function(i) {
        return get(A, i, j);
      });
    }));
  };

  var set = function set(A, i, j, x) {
    return _make(A.data.setIn([i, j], x));
  };

  var update = function update(A, i, j, fn) {
    return _make(A.data.updateIn([i, j], fn));
  };

  var plus = function plus(A, B) {
    if (A.nrows != B.nrows || A.ncols != B.ncols)
      throw new Error('shapes do not match');

    return _make(I.Range(0, A.nrows).map(function(i) {
      return I.Range(0, A.ncols).map(function(j) {
        return scalar.plus(get(A, i, j), get(B, i, j));
      });
    }));
  };

  var minus = function plus(A, B) {
    if (A.nrows != B.nrows || A.ncols != B.ncols)
      throw new Error('shapes do not match');

    return _make(I.Range(0, A.nrows).map(function(i) {
      return I.Range(0, A.ncols).map(function(j) {
        return scalar.minus(get(A, i, j), get(B, i, j));
      });
    }));
  };

  var scaled = function scaled(f, A) {
    return _make(A.data.map(function(row) {
      return row.map(function(x) {
        return scalar.times(f, x);
      });
    }));
  };

  var times = function times(A, B) {
    if (A.ncols != B.nrows)
      throw new Error('shapes do not match');

    return _make(I.Range(0, A.nrows).map(function(i) {
      return I.Range(0, B.ncols).map(function(j) {
        return I.Range(0, A.ncols)
          .map(function(k) { return scalar.times(get(A, i, k), get(B, k, j)); })
          .reduce(scalar.plus, zero);
      });
    }));
  };


  var _findPivot = function _findPivot(A, row, col, overField) {
    var best = row;
    for (var i = row; i < A.nrows; ++i) {
      var x = scalar.abs(get(A, i, col));
      if (scalar.sgn(x) != 0) {
        var d = scalar.cmp(x, scalar.abs(get(A, best, col)));
        if (overField ? d > 0 : d < 0)
          best = i;
      }
    }
    return best;
  };

  var _swapRows = function _swapRows(A, i, j) {
    return _make(A.data.set(i, A.data.get(j)).set(j, A.data.get(i)));
  };

  var _negateRow = function _negateRow(A, i) {
    return _make(A.data.set(i, A.data.get(i).map(scalar.negative)));
  };

  var _truncate = function _truncate(x, a) {
    var d = scalar.times(a, scalar.epsilon);
    if (scalar.cmp(scalar.abs(x), scalar.abs(d)) < 0)
      return zero;
    else
      return x;
  };

  var _adjustRow = function _adjustRow(A, i, j, f) {
    var _val = function(k) {
      return scalar.plus(get(A, i, k), scalar.times(get(A, j, k), f));
    };
    var val;

    if (scalar.epsilon)
      val = function(k) { return _truncate(_val(k), get(A, i, k)); };
    else
      val = _val;

    return _make(A.data.set(i, I.Range(0, A.ncols).map(val)));
  };

  var _Triangulation = I.Record({
    R: undefined,
    U: undefined,
    sign: undefined
  });

  var triangulation = function triangulation(A, overField) {
    var R = A;
    var U = identity(R.nrows);
    var col = 0;
    var sign = 1;
    var overField = !!overField;
    var divide = overField ? scalar.div : scalar.idiv;

    for (var row = 0; row < R.nrows; ++row) {
      var cleared = false;

      while (!cleared && col < R.ncols) {
        var pivotRow = _findPivot(R, row, col, overField);
        var pivot = get(R, pivotRow, col);

        if (scalar.sgn(pivot) == 0) {
          ++col;
          continue;
        }

        if (pivotRow != row) {
          R = _swapRows(R, row, pivotRow);
          U = _swapRows(U, row, pivotRow);
          sign *= -1;
        }

        if (scalar.sgn(pivot) < 0) {
          R = _negateRow(R, row);
          U = _negateRow(U, row);
          sign *= -1;
        }

        cleared = true;

        for (var k = row + 1; k < R.nrows; ++k) {
          if (scalar.sgn(get(R, k, col)) != 0) {
            var f = scalar.negative(divide(get(R, k, col), get(R, row, col)));

            R = _adjustRow(R, k, row, f);
            U = _adjustRow(U, k, row, f);

            if (overField)
              R = set(R, k, col, zero);
            else
              cleared = scalar.sgn(get(R, k, col)) == 0;
          }
        }

        if (cleared)
          ++col;
      }
    }

    return new _Triangulation({ R: R, U: U, sign: sign });
  };


  var _rank = function _rank(R) {
    var row = 0;
    for (var col = 0; col < R.ncols; ++col)
      if (row < R.nrows && scalar.sgn(get(R, row, col)) != 0)
        ++row;
    return row;
  };


  var rank = function rank(A) {
    return _rank(triangulation(A, true).R);
  };


  var _determinant = function _determinant(t) {
    return I.Range(0, t.R.nrows)
      .map(function(i) { return get(t.R, i, i); })
      .reduce(scalar.times, t.sign);
  };


  var determinant = function determinant(A) {
    if (A.nrows != A.ncols)
      throw new Error('must be a square matrix');

    return _determinant(triangulation(A, true));
  };


  var _solve = function _solve(R, v) {
    var n = R.nrows;
    var m = R.ncols;
    var k = v.ncols;

    var X = constant(m, k);
    var top = Math.min(n, m);

    for (var j = 0; j < k; ++j) {
      for (var i = top-1; i >= 0; --i) {
        var x = I.Range(i+1, top).map(function(nu) {
          return scalar.times(get(R, i, nu), get(X, nu, j));
        }).reduce(scalar.plus, zero);
        var right = scalar.minus(get(v, i, j), x);

        if (scalar.sgn(right) == 0)
          X = set(X, i, j, right);
        else if (scalar.sgn(get(R, i, i)) == 0)
          return null;
        else
          X = set(X, i, j, scalar.div(right, get(R, i, i)));
      }
    }

    return X;
  };


  var solve = function solve(A, b) {
    if (A.nrows != b.nrows)
      throw new Error('matrix shapes must match');

    var t = triangulation(A, true);

    return _solve(t.R, times(t.U, b));
  };


  var inverse = function inverse(A) {
    if (A.nrows != A.ncols)
      throw new Error('must be a square matrix');

    return solve(A, identity(A.nrows));
  };


  var _nullSpace = function _nullSpace(R) {
    var n = R.nrows;
    var m = R.ncols;
    var r = _rank(R);
    var d = m - r;

    if (d == 0)
      return null;
    else if (r == 0)
      return identity(m);

    var B = make(I.Range(0, r).map(function(i) {
      return I.Range(0, d).map(function(j) {
        return (j + r >= n) ? 0 : scalar.negative(M.get(R, i, j + r));
      });
    }));

    var S = _solve(make(R.data.slice(0,r)), B);
    return make(S.data.slice(0, r).concat(M.identity(d).data));
  };


  var nullSpace = function nullSpace(A) {
    return _nullSpace(triangulation(A, true).R);
  };


  var _rowProduct = function _rowProduct(A, i, j) {
    return I.Range(0, A.ncols)
      .map(function(k) { return scalar.times(get(A, i, k), get(A, j, k)); })
      .reduce(scalar.plus, zero);
  };

  var _normalizeRow = function _normalizeRow(A, i) {
    var norm = Math.sqrt(scalar.toJS(_rowProduct(A, i, i)));
    return _make(A.data.set(i, A.data.get(i).map(function(x) {
      return scalar.div(x, norm);
    })));
  };

  var orthonormalized = function orthonormalized(A) {
    I.Range(0, A.nrows).forEach(function(i) {
      I.Range(0, i).forEach(function(j) {
        A = _adjustRow(A, i, j, scalar.negative(_rowProduct(A, i, j)));
      });
      A = _normalizeRow(A, i);
    });
    return A;
  };


  return {
    make         : make,
    constant     : constant,
    identity     : identity,
    transposed   : transposed,
    set          : set,
    update       : update,
    get          : get,
    plus         : plus,
    minus        : minus,
    scaled       : scaled,
    times        : times,
    triangulation: triangulation,
    rank         : rank,
    determinant  : determinant,
    solve        : solve,
    inverse      : inverse,
    nullSpace    : nullSpace,
    orthonormalized: orthonormalized
  };
};


module.exports = matrix;


if (require.main == module) {
  var M = matrix(require('./number'), 0, 1);

  console.log(M.constant(3, 4));
  console.log(M.constant(3, 4, 5));
  console.log(M.identity(3));
  console.log(M.transposed(M.constant(3, 4, 5)));
  console.log(M.set(M.identity(3), 0, 1, 4));
  console.log(M.transposed(M.set(M.identity(3), 0, 1, 4)));
  console.log();

  var testTriangulation = function testTriangulation(A) {
    var t = M.triangulation(A);
    console.log('A = '+A);
    console.log('t.U = '+t.U);
    console.log('t.R = '+t.R);
    console.log('t.sign = '+t.sign);
    console.log('t.U * A = '+M.times(t.U, A));
    console.log('rk(A) = '+M.rank(A));
    console.log('det(A) = '+M.determinant(A));
    console.log();
  };

  testTriangulation(M.make([[1,2,3],[6,5,4],[7,8,9]]));
  testTriangulation(M.make([[1],[2,3],[4,5,6]]));

  var testSolve = function testSolve(A, b) {
    var x = M.solve(A, b);
    console.log('A = '+A);
    console.log('b = '+b);
    console.log('x = '+x);
    console.log('A * x = '+M.times(A, x));
    console.log();
  };

  testSolve(M.make([[1,2,3],[0,4,5],[0,0,6]]),
            M.make([[1],[1],[1]]));
  testSolve(M.make([[1,2,3],[0,4,5],[0,0,6]]),
            M.make([[1],[2,3],[4,5,6]]));

  var testInverse = function testInverse(A) {
    var B = M.inverse(A);
    console.log('A = '+A);
    console.log('R = '+M.triangulation(A, true).R);
    if (B) {
      console.log('A^-1 = '+B);
      console.log('A * A^-1 = '+M.times(A, B));
    }
    console.log('nullspace: '+M.nullSpace(A));
    console.log();
  };

  testInverse(M.make([[1],[2,3],[4,5,6]]));
  testInverse(M.make([[1,2,3],[0,4,5],[0,0,6]]));
  testInverse(M.make([[1,2,3],[4,5,6],[7,8,9]]));
  testInverse(M.make([[1,2,3],[2,4,6],[3,6,9]]));


  M = matrix(require('./float'), 0, 1);

  testInverse(M.make([[1],[2,3],[4,5,6]]));
  testInverse(M.make([[1,2,3],[0,4,5],[0,0,6]]));
  testInverse(M.make([[1,2,3],[4,5,6],[7,8,9]]));
  testInverse(M.make([[1,2,3],[2,4,6],[3,6,9]]));

  var testOrthonormalize = function testOrthonormalize(A) {
    console.log('A = '+A);
    var O = M.orthonormalized(A);
    console.log('O = '+O);
    console.log('O * O^t = '+M.times(O, M.transposed(O)));
    console.log();
  };

  testOrthonormalize(M.make([[1],[2,3],[4,5,6]]));
  testOrthonormalize(M.make([[1,2,3],[0,4,5],[0,0,6]]));
}
