export function methods(scalarOps, scalarTypes, overField, epsilon = null) {

  const s = scalarOps;

  const checkLen = (v, w) => {
    if (w.length == v.length)
      return true;
    else
      throw new Error('size mismatch');
  };


  const map = {
    V : f => v => v.map(x => f(x)),
    M : f => m => m.map(v => v.map(x => f(x))),
    VS: f => (v, s) => v.map(x => f(x, s)),
    MS: f => (m, s) => m.map(v => v.map(x => f(x, s))),
    SV: f => (s, v) => v.map(x => f(s, x)),
    SM: f => (s, m) => m.map(v => v.map(x => f(s, x))),
    VV: f => (v, w) => checkLen(v, w) && v.map((x, i) => f(x, w[i])),
    MM: f => (a, b) => checkLen(a, b) && a.map((v, i) => map.VV(f)(v, b[i]))
  };

  const mapFold = {
    V : (f, g) => v => v.map(x => f(x)).reduce((a, x) => g(a, x)),
    M : (f, g) => m => m.map(v => mapFold.V(f, g)(v)).reduce((a, x) => g(a, x))
  };


  const shapeOfMatrix = m => [m.length, m[0].length];

  const array = (len, val = 0) => Array(len).fill(val);

  const identity = n => array(n).map((_, i) => array(n).fill(1, i, i+1));


  const transposedMatrix = m => {
    const [nrows, ncols] = shapeOfMatrix(m);
    return array(ncols).map((_, j) => array(nrows).map((_, i) => m[i][j]));
  };


  const matrixProduct = (A, B) => {
    const [nrowsA, ncolsA] = shapeOfMatrix(A);
    const [nrowsB, ncolsB] = shapeOfMatrix(B);

    if (ncolsA != nrowsB)
      throw new Error('shapes do not match');

    return (
      array(nrowsA).map((_, i) => (
        array(ncolsB).map((_, j) => (
          array(ncolsA)
            .map((_, k) => s.times(A[i][k], B[k][j]))
            .reduce((a, x) => s.plus(a, x)))))));
  };


  const crossProduct = (v, w) => {
    if (v.length != 3 || w.length != 3)
      throw new Error('both vectors must have length 3');

    return [
      s.minus(s.times(v[1], w[2]), s.times(v[2], w[1])),
      s.minus(s.times(v[2], w[0]), s.times(v[0], w[2])),
      s.minus(s.times(v[0], w[1]), s.times(v[1], w[0]))
    ];
  };


  const _clone = A => A.map(row => row.slice());


  const _findPivot = (A, row, col) => {
    let best = row;
    for (let i = row; i < A.length; ++i) {
      const x = s.abs(A[i][col]);
      if (s.sgn(x) != 0) {
        const d = s.cmp(x, s.abs(A[best][col]));
        if (overField ? d > 0 : d < 0)
          best = i;
      }
    }
    return best;
  };

  const _swapRowsInPlace = (A, i, j) => { [A[i], A[j]] = [A[j], A[i]]; };

  const _negateRowInPlace = (A, i) => { A[i] = map.V(s.negative)(A[i]); };

  const _truncate = (x, a) =>
    (s.cmp(s.abs(x), s.abs(s.times(a, epsilon))) <= 0) ? 0 : x;

  const _adjustRowInPlace = (A, i, j, f) => {
    const fn0 = k => s.plus(A[i][k], s.times(A[j][k], f));
    const fn  = epsilon ? k => _truncate(fn0(k), A[i][k]) : fn0;

    const row = A[i];
    for (const j in row)
      row[j] = fn(j);
  };

  const triangulation = A => {
    const divide = overField ? s.div : s.idiv;
    const [nrows, ncols] = shapeOfMatrix(A);

    const R = _clone(A);
    const U = identity(A.length);
    let col = 0;
    let sign = 1;

    for (let row = 0; row < nrows; ++row) {
      let cleared = false;

      while (!cleared && col < ncols) {
        const pivotRow = _findPivot(R, row, col);
        const pivot = R[pivotRow][col];

        if (s.sgn(pivot) == 0) {
          ++col;
          continue;
        }

        if (pivotRow != row) {
          _swapRowsInPlace(R, row, pivotRow);
          _swapRowsInPlace(U, row, pivotRow);
          sign *= -1;
        }

        if (s.sgn(pivot) < 0) {
          _negateRowInPlace(R, row);
          _negateRowInPlace(U, row);
          sign *= -1;
        }

        cleared = true;

        for (let k = row + 1; k < nrows; ++k) {
          if (s.sgn(R[k][col]) != 0) {
            const f = s.negative(divide(R[k][col], R[row][col]));

            _adjustRowInPlace(R, k, row, f);
            _adjustRowInPlace(U, k, row, f);

            if (overField)
              R[k][col] = 0;
            else
              cleared = s.sgn(R[k][col]) == 0;
          }
        }

        if (cleared)
          ++col;
      }
    }

    return { R, U, sign };
  };


  const _rank = A => {
    const [nrows, ncols] = shapeOfMatrix(A);
    let row = 0;
    for (let col = 0; col < ncols; ++col) {
      if (row < nrows && s.sgn(A[row][col]) != 0)
        ++row;
    }
    return row;
  };


  const rank = A => _rank(triangulation(A).R);


  const determinant = A => {
    const [nrows, ncols] = shapeOfMatrix(A);
    if (nrows != ncols)
      throw new Error('must be a square matrix');

    const t = triangulation(A);
    return array(nrows)
      .map((_, i) => t.R[i][i])
      .reduce((a, x) => s.times(a, x), t.sign);
  };


  const _solve = (R, v) => {
    const [n, m] = shapeOfMatrix(R);
    const [_, k] = shapeOfMatrix(v);
    const top = Math.min(n, m);

    const X = array(m).map(() => array(k));

    for (let j = 0; j < k; ++j) {
      for (let i = top-1; i >= 0; --i) {
        let right = v[i][j];
        for (let nu = i+1; nu < top; ++nu) {
          right = s.minus(right, s.times(R[i][nu], X[nu][j]));
        }

        if (s.sgn(right) == 0)
          X[i][j] = right;
        else if (s.sgn(R[i][i]) == 0)
          return null;
        else
          X[i][j] = s.div(right, R[i][i]);
      }
    }

    return X;
  };


  const solve = (A, b) => {
    if (shapeOfMatrix(A)[0] != shapeOfMatrix(b)[0])
      throw new Error('matrix shapes must match');

    const t = triangulation(A);

    return _solve(t.R, matrixProduct(t.U, b));
  };


  const inverse = A => {
    const [nrows, ncols] = shapeOfMatrix(A);
    if (nrows != ncols)
      throw new Error('must be a square matrix');

    return solve(A, identity(nrows));
  };


  const _nullSpace = R => {
    const [n, m] = shapeOfMatrix(R);
    const r = _rank(R);
    const d = m - r;

    if (d == 0)
      return null;
    else if (r == 0)
      return identity(m);

    const B = (
      array(r).map((_, i) => (
        array(d).map((_, j) => (
          s.negative(R[i][j+r])))))
    );

    return _solve(R.slice(0,r), B)
      .slice(0, r).concat(identity(d));
  };


  const nullSpace = A => _nullSpace(triangulation(A).R);


  const _rowProduct = function _rowProduct(A, i, j) {
    return _array(A.ncols)
      .map((_, k) => s.times(get(A, i, k), get(A, j, k)))
      .reduce(s.plus, 0);
  };

  const _normalizeRowInPlace = (A, i) => {
    const norm = Math.sqrt(s.toJS(_rowProduct(A, i, i)));

    const row = A.data[i];
    for (const j in row)
      row[j] = s.div(row[j], norm);
  };

  const orthonormalized = function orthonormalized(A) {
    const O = _clone(A);

    _array(O.nrows).forEach((_, i) => {
      _array(i).forEach((_, j) => {
        _adjustRowInPlace(O, i, j, s.negative(_rowProduct(O, i, j)))
      });
      _normalizeRowInPlace(O, i);
    });

    return O;
  };


  const methods = {
    shape: {
      Vector: v => [v.length],
      Matrix: shapeOfMatrix
    },

    negative: {
      Vector: map.V(s.negative),
      Matrix: map.M(s.negative)
    },

    squareNorm: {
      Vector: mapFold.V(x => s.times(x, x), s.plus),
      Matrix: mapFold.M(x => s.times(x, x), s.plus)
    },

    norm: {
      Vector: v => s.sqrt(methods.squareNorm.Vector(v)),
      Matrix: m => s.sqrt(methods.squareNorm.Matrix(m))
    },

    transposed: {
      Vector: v => v.map(x => [x]),
      Matrix: transposedMatrix
    },

    triangulation: {
      Matrix: triangulation
    },

    rank: {
      Matrix: rank
    },

    determinant: {
      Matrix: determinant
    },

    solve: {
      Matrix: {
        Vector: (m, v) => solve(m, methods.transposed.Vector(v)),
        Matrix: solve
      }
    },

    inverse: {
      Matrix: inverse
    },

    nullSpace: {
      Matrix: nullSpace
    },

    crossProduct: {
      Vector: {
        Vector: crossProduct
      }
    },

    times: {
      Vector: {
        Vector: (v, w) => matrixProduct([v], methods.transposed.Vector(w)),
        Matrix: (v, m) => matrixProduct([v], m)
      },
      Matrix: {
        Vector: (m, v) => matrixProduct(m, methods.transposed.Vector(v)),
        Matrix: matrixProduct
      }
    }
  };

  for (const name of ['plus', 'minus', 'div', 'idiv']) {
    methods[name] = { Vector: {}, Matrix: {} };
  };

  for (const name of ['plus', 'minus', 'times', 'div', 'idiv']) {
    for (const sType of scalarTypes) {
      methods[name]['Vector'][sType] = map.VS(s[name]);
      methods[name]['Matrix'][sType] = map.MS(s[name]);
    }
  }

  for (const name of ['plus', 'minus', 'times']) {
    for (const sType of scalarTypes) {
      methods[name][sType] = {
        Vector: map.SV(s[name]),
        Matrix: map.SM(s[name])
      }
    }
  }

  for (const name of ['plus', 'minus']) {
    methods[name].Vector.Vector = map.VV(s[name]);
    methods[name].Matrix.Matrix = map.MM(s[name]);
  }

  return methods;
};


if (require.main == module) {
  const a = require('./base').arithmetic()

  a.register(require('./integers').methods());
  const integers = a.ops();

  a.register(require('./fractions').methods(
    integers, ['Integer', 'LongInt'], 'Fraction'
  ));
  const rationals = a.ops();

  a.register(require('./floats').methods(
    rationals, ['Integer', 'LongInt', 'Fraction']
  ));
  const reals = a.ops();

  a.register(
    methods(reals, ['Integer', 'LongInt', 'Fraction', 'Float'], true)
  );
  const ops = a.ops();

  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const V = [1, 2, 3];
  const M = [[1, 2, 3], [4, 5, 6]];

  console.log(ops.shape(V));
  console.log(ops.negative(V));
  console.log(ops.transposed(V));
  console.log(ops.squareNorm(V));
  console.log(ops.norm(V));
  console.log(ops.plus(V, [3, 2, 1]));
  console.log(ops.plus(V, 2));
  console.log(ops.minus(V, [0, 1, 2]));
  console.log(ops.minus(V, 1));
  console.log(ops.minus(1, V));
  console.log(ops.idiv(V, 2));
  console.log(ops.crossProduct([1, 0, 0], [1, 2, 0]));

  console.log();
  console.log(ops.negative(M));
  console.log(ops.shape(M));
  console.log(ops.transposed(M));
  console.log(ops.squareNorm(M));
  console.log(ops.norm(M));
  console.log(ops.plus(M, [[9, 8, 7], [6, 5, 4]]));
  console.log(ops.plus(M, 2));
  console.log(ops.minus(M, [[0, 1, 2], [3, 4, 5]]));
  console.log(ops.minus(M, 1));
  console.log(ops.minus(1, M));

  console.log();
  console.log(ops.times(V, V));
  console.log(ops.times(M, V));
  console.log(ops.times(V, ops.transposed(M)));
  console.log(ops.times(M, ops.transposed(M)));

  const A = [[1,2,3],[0,4,5],[0,0,6]];
  console.log(ops.triangulation(A));
  console.log(ops.rank(A));
  console.log(ops.determinant(A));

  console.log();
  const b = [1, 1, 1];
  const v = ops.solve(A, b);
  console.log(`${A} *\n${v} =\n${ops.times(A, v)}\n`);

  const Ainv = ops.inverse(A);
  console.log(`${A} *\n${Ainv} =\n${ops.times(A, Ainv)}\n`);

  const testNullSpace = B => {
    const N = ops.nullSpace(B);
    console.log(`${B} *\n${N} =\n${N ? ops.times(B, N) : N}\n`);
  }

  testNullSpace([[1,2,3], [2,4,6], [3,6,9]]);
  testNullSpace([[1,2,3,1], [4,5,6,1], [7,8,9,1]]);
}
