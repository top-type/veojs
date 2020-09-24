//CORE BigInteger.js sjcl.js sha256.js elliptic.min.js format.js rpc.js files.js codecBytes.js crypto.js merkle_proofs.js
function Veo() {
var bigInt = (function (undefined) {
    "use strict";

    var BASE = 1e7,
	LOG_BASE = 7,
	MAX_INT = 9007199254740992,
	MAX_INT_ARR = smallToArray(MAX_INT),
	LOG_MAX_INT = Math.log(MAX_INT);

    function Integer(v, radix) {
	if (typeof v === "undefined") return Integer[0];
	if (typeof radix !== "undefined") return +radix === 10 ? parseValue(v) : parseBase(v, radix);
	return parseValue(v);
    }

    function BigInteger(value, sign) {
	this.value = value;
	this.sign = sign;
	this.isSmall = false;
    }
    BigInteger.prototype = Object.create(Integer.prototype);

    function SmallInteger(value) {
	this.value = value;
	this.sign = value < 0;
	this.isSmall = true;
    }
    SmallInteger.prototype = Object.create(Integer.prototype);

    function isPrecise(n) {
	return -MAX_INT < n && n < MAX_INT;
    }

    function smallToArray(n) { // For performance reasons doesn't reference BASE, need to change this function if BASE changes
	if (n < 1e7)
	    return [n];
	if (n < 1e14)
	    return [n % 1e7, Math.floor(n / 1e7)];
	return [n % 1e7, Math.floor(n / 1e7) % 1e7, Math.floor(n / 1e14)];
    }

    function arrayToSmall(arr) { // If BASE changes this function may need to change
	trim(arr);
	var length = arr.length;
	if (length < 4 && compareAbs(arr, MAX_INT_ARR) < 0) {
	    switch (length) {
	    case 0: return 0;
	    case 1: return arr[0];
	    case 2: return arr[0] + arr[1] * BASE;
	    default: return arr[0] + (arr[1] + arr[2] * BASE) * BASE;
	    }
	}
	return arr;
    }

    function trim(v) {
	var i = v.length;
	while (v[--i] === 0);
	v.length = i + 1;
    }

    function createArray(length) { // function shamelessly stolen from Yaffle's library https://github.com/Yaffle/BigInteger
	var x = new Array(length);
	var i = -1;
	while (++i < length) {
	    x[i] = 0;
	}
	return x;
    }

    function truncate(n) {
	if (n > 0) return Math.floor(n);
	return Math.ceil(n);
    }

    function add(a, b) { // assumes a and b are arrays with a.length >= b.length
	var l_a = a.length,
	    l_b = b.length,
	    r = new Array(l_a),
	    carry = 0,
	    base = BASE,
	    sum, i;
	for (i = 0; i < l_b; i++) {
	    sum = a[i] + b[i] + carry;
	    carry = sum >= base ? 1 : 0;
	    r[i] = sum - carry * base;
	}
	while (i < l_a) {
	    sum = a[i] + carry;
	    carry = sum === base ? 1 : 0;
	    r[i++] = sum - carry * base;
	}
	if (carry > 0) r.push(carry);
	return r;
    }

    function addAny(a, b) {
	if (a.length >= b.length) return add(a, b);
	return add(b, a);
    }

    function addSmall(a, carry) { // assumes a is array, carry is number with 0 <= carry < MAX_INT
	var l = a.length,
	    r = new Array(l),
	    base = BASE,
	    sum, i;
	for (i = 0; i < l; i++) {
	    sum = a[i] - base + carry;
	    carry = Math.floor(sum / base);
	    r[i] = sum - carry * base;
	    carry += 1;
	}
	while (carry > 0) {
	    r[i++] = carry % base;
	    carry = Math.floor(carry / base);
	}
	return r;
    }

    BigInteger.prototype.add = function (v) {
	var n = parseValue(v);
	if (this.sign !== n.sign) {
	    return this.subtract(n.negate());
	}
	var a = this.value, b = n.value;
	if (n.isSmall) {
	    return new BigInteger(addSmall(a, Math.abs(b)), this.sign);
	}
	return new BigInteger(addAny(a, b), this.sign);
    };
    BigInteger.prototype.plus = BigInteger.prototype.add;

    SmallInteger.prototype.add = function (v) {
	var n = parseValue(v);
	var a = this.value;
	if (a < 0 !== n.sign) {
	    return this.subtract(n.negate());
	}
	var b = n.value;
	if (n.isSmall) {
	    if (isPrecise(a + b)) return new SmallInteger(a + b);
	    b = smallToArray(Math.abs(b));
	}
	return new BigInteger(addSmall(b, Math.abs(a)), a < 0);
    };
    SmallInteger.prototype.plus = SmallInteger.prototype.add;

    function subtract(a, b) { // assumes a and b are arrays with a >= b
	var a_l = a.length,
	    b_l = b.length,
	    r = new Array(a_l),
	    borrow = 0,
	    base = BASE,
	    i, difference;
	for (i = 0; i < b_l; i++) {
	    difference = a[i] - borrow - b[i];
	    if (difference < 0) {
		difference += base;
		borrow = 1;
	    } else borrow = 0;
	    r[i] = difference;
	}
	for (i = b_l; i < a_l; i++) {
	    difference = a[i] - borrow;
	    if (difference < 0) difference += base;
	    else {
		r[i++] = difference;
		break;
	    }
	    r[i] = difference;
	}
	for (; i < a_l; i++) {
	    r[i] = a[i];
	}
	trim(r);
	return r;
    }

    function subtractAny(a, b, sign) {
	var value;
	if (compareAbs(a, b) >= 0) {
	    value = subtract(a, b);
	} else {
	    value = subtract(b, a);
	    sign = !sign;
	}
	value = arrayToSmall(value);
	if (typeof value === "number") {
	    if (sign) value = -value;
	    return new SmallInteger(value);
	}
	return new BigInteger(value, sign);
    }

    function subtractSmall(a, b, sign) { // assumes a is array, b is number with 0 <= b < MAX_INT
	var l = a.length,
	    r = new Array(l),
	    carry = -b,
	    base = BASE,
	    i, difference;
	for (i = 0; i < l; i++) {
	    difference = a[i] + carry;
	    carry = Math.floor(difference / base);
	    difference %= base;
	    r[i] = difference < 0 ? difference + base : difference;
	}
	r = arrayToSmall(r);
	if (typeof r === "number") {
	    if (sign) r = -r;
	    return new SmallInteger(r);
	} return new BigInteger(r, sign);
    }

    BigInteger.prototype.subtract = function (v) {
	var n = parseValue(v);
	if (this.sign !== n.sign) {
	    return this.add(n.negate());
	}
	var a = this.value, b = n.value;
	if (n.isSmall)
	    return subtractSmall(a, Math.abs(b), this.sign);
	return subtractAny(a, b, this.sign);
    };
    BigInteger.prototype.minus = BigInteger.prototype.subtract;

    SmallInteger.prototype.subtract = function (v) {
	var n = parseValue(v);
	var a = this.value;
	if (a < 0 !== n.sign) {
	    return this.add(n.negate());
	}
	var b = n.value;
	if (n.isSmall) {
	    return new SmallInteger(a - b);
	}
	return subtractSmall(b, Math.abs(a), a >= 0);
    };
        SmallInteger.prototype.minus = SmallInteger.prototype.subtract;

BigInteger.prototype.negate = function () {
    return new BigInteger(this.value, !this.sign);
};
SmallInteger.prototype.negate = function () {
    var sign = this.sign;
    var small = new SmallInteger(-this.value);
    small.sign = !sign;
    return small;
};

BigInteger.prototype.abs = function () {
    return new BigInteger(this.value, false);
};
SmallInteger.prototype.abs = function () {
    return new SmallInteger(Math.abs(this.value));
};

function multiplyLong(a, b) {
    var a_l = a.length,
	b_l = b.length,
	l = a_l + b_l,
	r = createArray(l),
	base = BASE,
	product, carry, i, a_i, b_j;
    for (i = 0; i < a_l; ++i) {
	a_i = a[i];
	for (var j = 0; j < b_l; ++j) {
	    b_j = b[j];
	    product = a_i * b_j + r[i + j];
	    carry = Math.floor(product / base);
	    r[i + j] = product - carry * base;
	    r[i + j + 1] += carry;
	}
    }
    trim(r);
    return r;
}

function multiplySmall(a, b) { // assumes a is array, b is number with |b| < BASE
    var l = a.length,
	r = new Array(l),
	base = BASE,
	carry = 0,
	product, i;
    for (i = 0; i < l; i++) {
	product = a[i] * b + carry;
	carry = Math.floor(product / base);
	r[i] = product - carry * base;
    }
    while (carry > 0) {
	r[i++] = carry % base;
	carry = Math.floor(carry / base);
    }
    return r;
}

function shiftLeft(x, n) {
    var r = [];
    while (n-- > 0) r.push(0);
    return r.concat(x);
}

function multiplyKaratsuba(x, y) {
    var n = Math.max(x.length, y.length);

    if (n <= 30) return multiplyLong(x, y);
    n = Math.ceil(n / 2);

    var b = x.slice(n),
	a = x.slice(0, n),
	d = y.slice(n),
	c = y.slice(0, n);

    var ac = multiplyKaratsuba(a, c),
	bd = multiplyKaratsuba(b, d),
	abcd = multiplyKaratsuba(addAny(a, b), addAny(c, d));

    var product = addAny(addAny(ac, shiftLeft(subtract(subtract(abcd, ac), bd), n)), shiftLeft(bd, 2 * n));
    trim(product);
    return product;
}

// The following function is derived from a surface fit of a graph plotting the performance difference
// between long multiplication and karatsuba multiplication versus the lengths of the two arrays.
function useKaratsuba(l1, l2) {
    return -0.012 * l1 - 0.012 * l2 + 0.000015 * l1 * l2 > 0;
}

BigInteger.prototype.multiply = function (v) {
    var n = parseValue(v),
	a = this.value, b = n.value,
	sign = this.sign !== n.sign,
	abs;
    if (n.isSmall) {
	if (b === 0) return Integer[0];
	if (b === 1) return this;
	if (b === -1) return this.negate();
	abs = Math.abs(b);
	if (abs < BASE) {
	    return new BigInteger(multiplySmall(a, abs), sign);
	}
	b = smallToArray(abs);
    }
    if (useKaratsuba(a.length, b.length)) // Karatsuba is only faster for certain array sizes
	return new BigInteger(multiplyKaratsuba(a, b), sign);
    return new BigInteger(multiplyLong(a, b), sign);
};

BigInteger.prototype.times = BigInteger.prototype.multiply;

function multiplySmallAndArray(a, b, sign) { // a >= 0
    if (a < BASE) {
	return new BigInteger(multiplySmall(b, a), sign);
    }
    return new BigInteger(multiplyLong(b, smallToArray(a)), sign);
}
SmallInteger.prototype._multiplyBySmall = function (a) {
    if (isPrecise(a.value * this.value)) {
	return new SmallInteger(a.value * this.value);
    }
    return multiplySmallAndArray(Math.abs(a.value), smallToArray(Math.abs(this.value)), this.sign !== a.sign);
};
BigInteger.prototype._multiplyBySmall = function (a) {
    if (a.value === 0) return Integer[0];
    if (a.value === 1) return this;
    if (a.value === -1) return this.negate();
    return multiplySmallAndArray(Math.abs(a.value), this.value, this.sign !== a.sign);
};
SmallInteger.prototype.multiply = function (v) {
    return parseValue(v)._multiplyBySmall(this);
};
SmallInteger.prototype.times = SmallInteger.prototype.multiply;

function square(a) {
    //console.assert(2 * BASE * BASE < MAX_INT);
    var l = a.length,
	r = createArray(l + l),
	base = BASE,
	product, carry, i, a_i, a_j;
    for (i = 0; i < l; i++) {
	a_i = a[i];
	carry = 0 - a_i * a_i;
	for (var j = i; j < l; j++) {
	    a_j = a[j];
	    product = 2 * (a_i * a_j) + r[i + j] + carry;
	    carry = Math.floor(product / base);
	    r[i + j] = product - carry * base;
	}
	r[i + l] = carry;
    }
    trim(r);
    return r;
}

BigInteger.prototype.square = function () {
    return new BigInteger(square(this.value), false);
};

SmallInteger.prototype.square = function () {
    var value = this.value * this.value;
    if (isPrecise(value)) return new SmallInteger(value);
    return new BigInteger(square(smallToArray(Math.abs(this.value))), false);
};

function divMod1(a, b) { // Left over from previous version. Performs faster than divMod2 on smaller input sizes.
    var a_l = a.length,
	b_l = b.length,
	base = BASE,
	result = createArray(b.length),
	divisorMostSignificantDigit = b[b_l - 1],
	// normalization
	lambda = Math.ceil(base / (2 * divisorMostSignificantDigit)),
	remainder = multiplySmall(a, lambda),
	divisor = multiplySmall(b, lambda),
	quotientDigit, shift, carry, borrow, i, l, q;
    if (remainder.length <= a_l) remainder.push(0);
    divisor.push(0);
    divisorMostSignificantDigit = divisor[b_l - 1];
    for (shift = a_l - b_l; shift >= 0; shift--) {
	quotientDigit = base - 1;
	if (remainder[shift + b_l] !== divisorMostSignificantDigit) {
	    quotientDigit = Math.floor((remainder[shift + b_l] * base + remainder[shift + b_l - 1]) / divisorMostSignificantDigit);
	}
	// quotientDigit <= base - 1
	carry = 0;
	borrow = 0;
	l = divisor.length;
	for (i = 0; i < l; i++) {
	    carry += quotientDigit * divisor[i];
	    q = Math.floor(carry / base);
	    borrow += remainder[shift + i] - (carry - q * base);
	    carry = q;
	    if (borrow < 0) {
		remainder[shift + i] = borrow + base;
		borrow = -1;
	    } else {
		remainder[shift + i] = borrow;
		borrow = 0;
	    }
	}
	while (borrow !== 0) {
	    quotientDigit -= 1;
	    carry = 0;
	    for (i = 0; i < l; i++) {
		carry += remainder[shift + i] - base + divisor[i];
		if (carry < 0) {
		    remainder[shift + i] = carry + base;
		    carry = 0;
		} else {
		    remainder[shift + i] = carry;
		    carry = 1;
		}
	    }
	    borrow += carry;
	}
	result[shift] = quotientDigit;
    }
    // denormalization
    remainder = divModSmall(remainder, lambda)[0];
    return [arrayToSmall(result), arrayToSmall(remainder)];
}

function divMod2(a, b) { // Implementation idea shamelessly stolen from Silent Matt's library http://silentmatt.com/biginteger/
    // Performs faster than divMod1 on larger input sizes.
    var a_l = a.length,
	b_l = b.length,
	result = [],
	part = [],
	base = BASE,
	guess, xlen, highx, highy, check;
    while (a_l) {
	part.unshift(a[--a_l]);
	trim(part);
	if (compareAbs(part, b) < 0) {
	    result.push(0);
	    continue;
	}
	xlen = part.length;
	highx = part[xlen - 1] * base + part[xlen - 2];
	highy = b[b_l - 1] * base + b[b_l - 2];
	if (xlen > b_l) {
	    highx = (highx + 1) * base;
	}
	guess = Math.ceil(highx / highy);
	do {
	    check = multiplySmall(b, guess);
	    if (compareAbs(check, part) <= 0) break;
	    guess--;
	} while (guess);
	result.push(guess);
	part = subtract(part, check);
    }
    result.reverse();
    return [arrayToSmall(result), arrayToSmall(part)];
}

function divModSmall(value, lambda) {
    var length = value.length,
	quotient = createArray(length),
	base = BASE,
	i, q, remainder, divisor;
    remainder = 0;
    for (i = length - 1; i >= 0; --i) {
	divisor = remainder * base + value[i];
	q = truncate(divisor / lambda);
	remainder = divisor - q * lambda;
	quotient[i] = q | 0;
    }
    return [quotient, remainder | 0];
}

function divModAny(self, v) {
    var value, n = parseValue(v);
    var a = self.value, b = n.value;
    var quotient;
    if (b === 0) throw new Error("Cannot divide by zero");
    if (self.isSmall) {
	if (n.isSmall) {
	    return [new SmallInteger(truncate(a / b)), new SmallInteger(a % b)];
	}
	return [Integer[0], self];
    }
    if (n.isSmall) {
	if (b === 1) return [self, Integer[0]];
	if (b == -1) return [self.negate(), Integer[0]];
	var abs = Math.abs(b);
	if (abs < BASE) {
	    value = divModSmall(a, abs);
	    quotient = arrayToSmall(value[0]);
	    var remainder = value[1];
	    if (self.sign) remainder = -remainder;
	    if (typeof quotient === "number") {
		if (self.sign !== n.sign) quotient = -quotient;
		return [new SmallInteger(quotient), new SmallInteger(remainder)];
	    }
	    return [new BigInteger(quotient, self.sign !== n.sign), new SmallInteger(remainder)];
	}
	b = smallToArray(abs);
    }
    var comparison = compareAbs(a, b);
    if (comparison === -1) return [Integer[0], self];
    if (comparison === 0) return [Integer[self.sign === n.sign ? 1 : -1], Integer[0]];

    // divMod1 is faster on smaller input sizes
    if (a.length + b.length <= 200)
	value = divMod1(a, b);
    else value = divMod2(a, b);

    quotient = value[0];
    var qSign = self.sign !== n.sign,
	mod = value[1],
	mSign = self.sign;
    if (typeof quotient === "number") {
	if (qSign) quotient = -quotient;
	quotient = new SmallInteger(quotient);
    } else quotient = new BigInteger(quotient, qSign);
    if (typeof mod === "number") {
	if (mSign) mod = -mod;
	mod = new SmallInteger(mod);
    } else mod = new BigInteger(mod, mSign);
    return [quotient, mod];
}

BigInteger.prototype.divmod = function (v) {
    var result = divModAny(this, v);
    return {
	quotient: result[0],
	remainder: result[1]
    };
};
SmallInteger.prototype.divmod = BigInteger.prototype.divmod;

BigInteger.prototype.divide = function (v) {
    return divModAny(this, v)[0];
};
SmallInteger.prototype.over = SmallInteger.prototype.divide = BigInteger.prototype.over = BigInteger.prototype.divide;

BigInteger.prototype.mod = function (v) {
    return divModAny(this, v)[1];
};
SmallInteger.prototype.remainder = SmallInteger.prototype.mod = BigInteger.prototype.remainder = BigInteger.prototype.mod;

BigInteger.prototype.pow = function (v) {
    var n = parseValue(v),
	a = this.value,
	b = n.value,
	value, x, y;
    if (b === 0) return Integer[1];
    if (a === 0) return Integer[0];
    if (a === 1) return Integer[1];
    if (a === -1) return n.isEven() ? Integer[1] : Integer[-1];
    if (n.sign) {
	return Integer[0];
    }
    if (!n.isSmall) throw new Error("The exponent " + n.toString() + " is too large.");
    if (this.isSmall) {
	if (isPrecise(value = Math.pow(a, b)))
	    return new SmallInteger(truncate(value));
    }
    x = this;
    y = Integer[1];
    while (true) {
	if (b & 1 === 1) {
	    y = y.times(x);
	    --b;
	}
	if (b === 0) break;
	b /= 2;
	x = x.square();
    }
    return y;
};
SmallInteger.prototype.pow = BigInteger.prototype.pow;

BigInteger.prototype.modPow = function (exp, mod) {
    exp = parseValue(exp);
    mod = parseValue(mod);
    if (mod.isZero()) throw new Error("Cannot take modPow with modulus 0");
    var r = Integer[1],
	base = this.mod(mod);
    while (exp.isPositive()) {
	if (base.isZero()) return Integer[0];
	if (exp.isOdd()) r = r.multiply(base).mod(mod);
	exp = exp.divide(2);
	base = base.square().mod(mod);
    }
    return r;
};
SmallInteger.prototype.modPow = BigInteger.prototype.modPow;

function compareAbs(a, b) {
    if (a.length !== b.length) {
	return a.length > b.length ? 1 : -1;
    }
    for (var i = a.length - 1; i >= 0; i--) {
	if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    }
    return 0;
}

BigInteger.prototype.compareAbs = function (v) {
    var n = parseValue(v),
	a = this.value,
	b = n.value;
    if (n.isSmall) return 1;
    return compareAbs(a, b);
};
SmallInteger.prototype.compareAbs = function (v) {
    var n = parseValue(v),
	a = Math.abs(this.value),
	b = n.value;
    if (n.isSmall) {
	b = Math.abs(b);
	return a === b ? 0 : a > b ? 1 : -1;
    }
    return -1;
};

BigInteger.prototype.compare = function (v) {
    // See discussion about comparison with Infinity:
    // https://github.com/peterolson/BigInteger.js/issues/61
    if (v === Infinity) {
	return -1;
    }
    if (v === -Infinity) {
	return 1;
    }

    var n = parseValue(v),
	a = this.value,
	b = n.value;
    if (this.sign !== n.sign) {
	return n.sign ? 1 : -1;
    }
    if (n.isSmall) {
	return this.sign ? -1 : 1;
    }
    return compareAbs(a, b) * (this.sign ? -1 : 1);
};
BigInteger.prototype.compareTo = BigInteger.prototype.compare;

SmallInteger.prototype.compare = function (v) {
    if (v === Infinity) {
	return -1;
    }
    if (v === -Infinity) {
	return 1;
    }

    var n = parseValue(v),
	a = this.value,
	b = n.value;
    if (n.isSmall) {
	return a == b ? 0 : a > b ? 1 : -1;
    }
    if (a < 0 !== n.sign) {
	return a < 0 ? -1 : 1;
    }
    return a < 0 ? 1 : -1;
};
SmallInteger.prototype.compareTo = SmallInteger.prototype.compare;

BigInteger.prototype.equals = function (v) {
    return this.compare(v) === 0;
};
SmallInteger.prototype.eq = SmallInteger.prototype.equals = BigInteger.prototype.eq = BigInteger.prototype.equals;

BigInteger.prototype.notEquals = function (v) {
    return this.compare(v) !== 0;
};
SmallInteger.prototype.neq = SmallInteger.prototype.notEquals = BigInteger.prototype.neq = BigInteger.prototype.notEquals;

BigInteger.prototype.greater = function (v) {
    return this.compare(v) > 0;
};
SmallInteger.prototype.gt = SmallInteger.prototype.greater = BigInteger.prototype.gt = BigInteger.prototype.greater;

BigInteger.prototype.lesser = function (v) {
    return this.compare(v) < 0;
};
SmallInteger.prototype.lt = SmallInteger.prototype.lesser = BigInteger.prototype.lt = BigInteger.prototype.lesser;

BigInteger.prototype.greaterOrEquals = function (v) {
    return this.compare(v) >= 0;
};
SmallInteger.prototype.geq = SmallInteger.prototype.greaterOrEquals = BigInteger.prototype.geq = BigInteger.prototype.greaterOrEquals;

BigInteger.prototype.lesserOrEquals = function (v) {
    return this.compare(v) <= 0;
};
SmallInteger.prototype.leq = SmallInteger.prototype.lesserOrEquals = BigInteger.prototype.leq = BigInteger.prototype.lesserOrEquals;

BigInteger.prototype.isEven = function () {
    return (this.value[0] & 1) === 0;
};
SmallInteger.prototype.isEven = function () {
    return (this.value & 1) === 0;
};

BigInteger.prototype.isOdd = function () {
    return (this.value[0] & 1) === 1;
};
SmallInteger.prototype.isOdd = function () {
    return (this.value & 1) === 1;
};

BigInteger.prototype.isPositive = function () {
    return !this.sign;
};
SmallInteger.prototype.isPositive = function () {
    return this.value > 0;
};

BigInteger.prototype.isNegative = function () {
    return this.sign;
};
SmallInteger.prototype.isNegative = function () {
    return this.value < 0;
};

BigInteger.prototype.isUnit = function () {
    return false;
};
SmallInteger.prototype.isUnit = function () {
    return Math.abs(this.value) === 1;
};

BigInteger.prototype.isZero = function () {
    return false;
};
SmallInteger.prototype.isZero = function () {
    return this.value === 0;
};
BigInteger.prototype.isDivisibleBy = function (v) {
    var n = parseValue(v);
    var value = n.value;
    if (value === 0) return false;
    if (value === 1) return true;
    if (value === 2) return this.isEven();
    return this.mod(n).equals(Integer[0]);
};
SmallInteger.prototype.isDivisibleBy = BigInteger.prototype.isDivisibleBy;

function isBasicPrime(v) {
    var n = v.abs();
    if (n.isUnit()) return false;
    if (n.equals(2) || n.equals(3) || n.equals(5)) return true;
    if (n.isEven() || n.isDivisibleBy(3) || n.isDivisibleBy(5)) return false;
    if (n.lesser(25)) return true;
    // we don't know if it's prime: let the other functions figure it out
}

BigInteger.prototype.isPrime = function () {
    var isPrime = isBasicPrime(this);
    if (isPrime !== undefined) return isPrime;
    var n = this.abs(),
	nPrev = n.prev();
    var a = [2, 3, 5, 7, 11, 13, 17, 19],
	b = nPrev,
	d, t, i, x;
    while (b.isEven()) b = b.divide(2);
    for (i = 0; i < a.length; i++) {
	x = bigInt(a[i]).modPow(b, n);
	if (x.equals(Integer[1]) || x.equals(nPrev)) continue;
	for (t = true, d = b; t && d.lesser(nPrev); d = d.multiply(2)) {
	    x = x.square().mod(n);
	    if (x.equals(nPrev)) t = false;
	}
	if (t) return false;
    }
    return true;
};
SmallInteger.prototype.isPrime = BigInteger.prototype.isPrime;

BigInteger.prototype.isProbablePrime = function (iterations) {
    var isPrime = isBasicPrime(this);
    if (isPrime !== undefined) return isPrime;
    var n = this.abs();
    var t = iterations === undefined ? 5 : iterations;
    // use the Fermat primality test
    for (var i = 0; i < t; i++) {
	var a = bigInt.randBetween(2, n.minus(2));
	if (!a.modPow(n.prev(), n).isUnit()) return false; // definitely composite
    }
    return true; // large chance of being prime
};
SmallInteger.prototype.isProbablePrime = BigInteger.prototype.isProbablePrime;

BigInteger.prototype.modInv = function (n) {
    var t = bigInt.zero, newT = bigInt.one, r = parseValue(n), newR = this.abs(), q, lastT, lastR;
    while (!newR.equals(bigInt.zero)) {
	q = r.divide(newR);
	lastT = t;
	lastR = r;
	t = newT;
	r = newR;
	newT = lastT.subtract(q.multiply(newT));
	newR = lastR.subtract(q.multiply(newR));
    }
    if (!r.equals(1)) throw new Error(this.toString() + " and " + n.toString() + " are not co-prime");
    if (t.compare(0) === -1) {
	t = t.add(n);
    }
    if (this.isNegative()) {
	return t.negate();
    }
    return t;
};

SmallInteger.prototype.modInv = BigInteger.prototype.modInv;

BigInteger.prototype.next = function () {
    var value = this.value;
    if (this.sign) {
	return subtractSmall(value, 1, this.sign);
    }
    return new BigInteger(addSmall(value, 1), this.sign);
};
SmallInteger.prototype.next = function () {
    var value = this.value;
    if (value + 1 < MAX_INT) return new SmallInteger(value + 1);
    return new BigInteger(MAX_INT_ARR, false);
};

BigInteger.prototype.prev = function () {
    var value = this.value;
    if (this.sign) {
	return new BigInteger(addSmall(value, 1), true);
    }
    return subtractSmall(value, 1, this.sign);
};
SmallInteger.prototype.prev = function () {
    var value = this.value;
    if (value - 1 > -MAX_INT) return new SmallInteger(value - 1);
    return new BigInteger(MAX_INT_ARR, true);
};

var powersOfTwo = [1];
while (2 * powersOfTwo[powersOfTwo.length - 1] <= BASE) powersOfTwo.push(2 * powersOfTwo[powersOfTwo.length - 1]);
var powers2Length = powersOfTwo.length, highestPower2 = powersOfTwo[powers2Length - 1];

function shift_isSmall(n) {
    return ((typeof n === "number" || typeof n === "string") && +Math.abs(n) <= BASE) ||
	(n instanceof BigInteger && n.value.length <= 1);
}

BigInteger.prototype.shiftLeft = function (n) {
    if (!shift_isSmall(n)) {
	throw new Error(String(n) + " is too large for shifting.");
    }
    n = +n;
    if (n < 0) return this.shiftRight(-n);
    var result = this;
    if (result.isZero()) return result;
    while (n >= powers2Length) {
	result = result.multiply(highestPower2);
	n -= powers2Length - 1;
    }
    return result.multiply(powersOfTwo[n]);
};
SmallInteger.prototype.shiftLeft = BigInteger.prototype.shiftLeft;

BigInteger.prototype.shiftRight = function (n) {
    var remQuo;
    if (!shift_isSmall(n)) {
	throw new Error(String(n) + " is too large for shifting.");
    }
    n = +n;
    if (n < 0) return this.shiftLeft(-n);
    var result = this;
    while (n >= powers2Length) {
	if (result.isZero() || (result.isNegative() && result.isUnit())) return result;
	remQuo = divModAny(result, highestPower2);
	result = remQuo[1].isNegative() ? remQuo[0].prev() : remQuo[0];
	n -= powers2Length - 1;
    }
    remQuo = divModAny(result, powersOfTwo[n]);
    return remQuo[1].isNegative() ? remQuo[0].prev() : remQuo[0];
};
SmallInteger.prototype.shiftRight = BigInteger.prototype.shiftRight;

function bitwise(x, y, fn) {
    y = parseValue(y);
    var xSign = x.isNegative(), ySign = y.isNegative();
    var xRem = xSign ? x.not() : x,
	yRem = ySign ? y.not() : y;
    var xDigit = 0, yDigit = 0;
    var xDivMod = null, yDivMod = null;
    var result = [];
    while (!xRem.isZero() || !yRem.isZero()) {
	xDivMod = divModAny(xRem, highestPower2);
	xDigit = xDivMod[1].toJSNumber();
	if (xSign) {
	    xDigit = highestPower2 - 1 - xDigit; // two's complement for negative numbers
	}

	yDivMod = divModAny(yRem, highestPower2);
	yDigit = yDivMod[1].toJSNumber();
	if (ySign) {
	    yDigit = highestPower2 - 1 - yDigit; // two's complement for negative numbers
	}

	xRem = xDivMod[0];
	yRem = yDivMod[0];
	result.push(fn(xDigit, yDigit));
    }
    var sum = fn(xSign ? 1 : 0, ySign ? 1 : 0) !== 0 ? bigInt(-1) : bigInt(0);
    for (var i = result.length - 1; i >= 0; i -= 1) {
	sum = sum.multiply(highestPower2).add(bigInt(result[i]));
    }
    return sum;
}

BigInteger.prototype.not = function () {
    return this.negate().prev();
};
SmallInteger.prototype.not = BigInteger.prototype.not;

BigInteger.prototype.and = function (n) {
    return bitwise(this, n, function (a, b) { return a & b; });
};
SmallInteger.prototype.and = BigInteger.prototype.and;

BigInteger.prototype.or = function (n) {
    return bitwise(this, n, function (a, b) { return a | b; });
};
SmallInteger.prototype.or = BigInteger.prototype.or;

BigInteger.prototype.xor = function (n) {
    return bitwise(this, n, function (a, b) { return a ^ b; });
};
SmallInteger.prototype.xor = BigInteger.prototype.xor;

var LOBMASK_I = 1 << 30, LOBMASK_BI = (BASE & -BASE) * (BASE & -BASE) | LOBMASK_I;
function roughLOB(n) { // get lowestOneBit (rough)
    // SmallInteger: return Min(lowestOneBit(n), 1 << 30)
    // BigInteger: return Min(lowestOneBit(n), 1 << 14) [BASE=1e7]
    var v = n.value, x = typeof v === "number" ? v | LOBMASK_I : v[0] + v[1] * BASE | LOBMASK_BI;
    return x & -x;
}

function integerLogarithm(value, base) {
    if (base.compareTo(value) <= 0) {
	var tmp = integerLogarithm(value, base.square(base));
	var p = tmp.p;
	var e = tmp.e;
	var t = p.multiply(base);
	return t.compareTo(value) <= 0 ? { p: t, e: e * 2 + 1 } : { p: p, e: e * 2 };
    }
    return { p: bigInt(1), e: 0 };
}

BigInteger.prototype.bitLength = function () {
    var n = this;
    if (n.compareTo(bigInt(0)) < 0) {
	n = n.negate().subtract(bigInt(1));
    }
    if (n.compareTo(bigInt(0)) === 0) {
	return bigInt(0);
    }
    return bigInt(integerLogarithm(n, bigInt(2)).e).add(bigInt(1));
}
SmallInteger.prototype.bitLength = BigInteger.prototype.bitLength;

function max(a, b) {
    a = parseValue(a);
    b = parseValue(b);
    return a.greater(b) ? a : b;
}
function min(a, b) {
    a = parseValue(a);
    b = parseValue(b);
    return a.lesser(b) ? a : b;
}
function gcd(a, b) {
    a = parseValue(a).abs();
    b = parseValue(b).abs();
    if (a.equals(b)) return a;
    if (a.isZero()) return b;
    if (b.isZero()) return a;
    var c = Integer[1], d, t;
    while (a.isEven() && b.isEven()) {
	d = Math.min(roughLOB(a), roughLOB(b));
	a = a.divide(d);
	b = b.divide(d);
	c = c.multiply(d);
    }
    while (a.isEven()) {
	a = a.divide(roughLOB(a));
    }
    do {
	while (b.isEven()) {
	    b = b.divide(roughLOB(b));
	}
	if (a.greater(b)) {
	    t = b; b = a; a = t;
	}
	b = b.subtract(a);
    } while (!b.isZero());
    return c.isUnit() ? a : a.multiply(c);
}
function lcm(a, b) {
    a = parseValue(a).abs();
    b = parseValue(b).abs();
    return a.divide(gcd(a, b)).multiply(b);
}
function randBetween(a, b) {
    a = parseValue(a);
    b = parseValue(b);
    var low = min(a, b), high = max(a, b);
    var range = high.subtract(low).add(1);
    if (range.isSmall) return low.add(Math.floor(Math.random() * range));
    var length = range.value.length - 1;
    var result = [], restricted = true;
    for (var i = length; i >= 0; i--) {
	var top = restricted ? range.value[i] : BASE;
	var digit = truncate(Math.random() * top);
	result.unshift(digit);
	if (digit < top) restricted = false;
    }
    result = arrayToSmall(result);
    return low.add(typeof result === "number" ? new SmallInteger(result) : new BigInteger(result, false));
}
var parseBase = function (text, base) {
    var length = text.length;
    var i;
    var absBase = Math.abs(base);
    for (var i = 0; i < length; i++) {
	var c = text[i].toLowerCase();
	if (c === "-") continue;
	if (/[a-z0-9]/.test(c)) {
	    if (/[0-9]/.test(c) && +c >= absBase) {
		if (c === "1" && absBase === 1) continue;
		throw new Error(c + " is not a valid digit in base " + base + ".");
	    } else if (c.charCodeAt(0) - 87 >= absBase) {
		throw new Error(c + " is not a valid digit in base " + base + ".");
	    }
	}
    }
    if (2 <= base && base <= 36) {
	if (length <= LOG_MAX_INT / Math.log(base)) {
	    var result = parseInt(text, base);
	    if (isNaN(result)) {
		throw new Error(c + " is not a valid digit in base " + base + ".");
	    }
	    return new SmallInteger(parseInt(text, base));
	}
    }
    base = parseValue(base);
    var digits = [];
    var isNegative = text[0] === "-";
    for (i = isNegative ? 1 : 0; i < text.length; i++) {
	var c = text[i].toLowerCase(),
	    charCode = c.charCodeAt(0);
	if (48 <= charCode && charCode <= 57) digits.push(parseValue(c));
	else if (97 <= charCode && charCode <= 122) digits.push(parseValue(c.charCodeAt(0) - 87));
	else if (c === "<") {
	    var start = i;
	    do { i++; } while (text[i] !== ">");
	    digits.push(parseValue(text.slice(start + 1, i)));
	}
	else throw new Error(c + " is not a valid character");
    }
    return parseBaseFromArray(digits, base, isNegative);
};

function parseBaseFromArray(digits, base, isNegative) {
    var val = Integer[0], pow = Integer[1], i;
    for (i = digits.length - 1; i >= 0; i--) {
	val = val.add(digits[i].times(pow));
	pow = pow.times(base);
    }
    return isNegative ? val.negate() : val;
}

function stringify(digit) {
    if (digit <= 35) {
	return "0123456789abcdefghijklmnopqrstuvwxyz".charAt(digit);
    }
    return "<" + digit + ">";
}

function toBase(n, base) {
    base = bigInt(base);
    if (base.isZero()) {
	if (n.isZero()) return { value: [0], isNegative: false };
	throw new Error("Cannot convert nonzero numbers to base 0.");
    }
    if (base.equals(-1)) {
	if (n.isZero()) return { value: [0], isNegative: false };
	if (n.isNegative())
	    return {
		value: [].concat.apply([], Array.apply(null, Array(-n))
				       .map(Array.prototype.valueOf, [1, 0])
				      ),
		isNegative: false
	    };

	var arr = Array.apply(null, Array(+n - 1))
	    .map(Array.prototype.valueOf, [0, 1]);
	arr.unshift([1]);
	return {
	    value: [].concat.apply([], arr),
	    isNegative: false
	};
    }

    var neg = false;
    if (n.isNegative() && base.isPositive()) {
	neg = true;
	n = n.abs();
    }
    if (base.equals(1)) {
	if (n.isZero()) return { value: [0], isNegative: false };

	return {
	    value: Array.apply(null, Array(+n))
	        .map(Number.prototype.valueOf, 1),
	    isNegative: neg
	};
    }
    var out = [];
    var left = n, divmod;
    while (left.isNegative() || left.compareAbs(base) >= 0) {
	divmod = left.divmod(base);
	left = divmod.quotient;
	var digit = divmod.remainder;
	if (digit.isNegative()) {
	    digit = base.minus(digit).abs();
	    left = left.next();
	}
	out.push(digit.toJSNumber());
    }
    out.push(left.toJSNumber());
    return { value: out.reverse(), isNegative: neg };
}

function toBaseString(n, base) {
    var arr = toBase(n, base);
    return (arr.isNegative ? "-" : "") + arr.value.map(stringify).join('');
}

BigInteger.prototype.toArray = function (radix) {
    return toBase(this, radix);
};

SmallInteger.prototype.toArray = function (radix) {
    return toBase(this, radix);
};

BigInteger.prototype.toString = function (radix) {
    if (radix === undefined) radix = 10;
    if (radix !== 10) return toBaseString(this, radix);
    var v = this.value, l = v.length, str = String(v[--l]), zeros = "0000000", digit;
    while (--l >= 0) {
	digit = String(v[l]);
	str += zeros.slice(digit.length) + digit;
    }
    var sign = this.sign ? "-" : "";
    return sign + str;
};

SmallInteger.prototype.toString = function (radix) {
    if (radix === undefined) radix = 10;
    if (radix != 10) return toBaseString(this, radix);
    return String(this.value);
};
BigInteger.prototype.toJSON = SmallInteger.prototype.toJSON = function () { return this.toString(); }

BigInteger.prototype.valueOf = function () {
    return parseInt(this.toString(), 10);
};
BigInteger.prototype.toJSNumber = BigInteger.prototype.valueOf;

SmallInteger.prototype.valueOf = function () {
    return this.value;
};
SmallInteger.prototype.toJSNumber = SmallInteger.prototype.valueOf;

function parseStringValue(v) {
    if (isPrecise(+v)) {
	var x = +v;
	if (x === truncate(x))
	    return new SmallInteger(x);
	throw new Error("Invalid integer: " + v);
    }
    var sign = v[0] === "-";
    if (sign) v = v.slice(1);
    var split = v.split(/e/i);
    if (split.length > 2) throw new Error("Invalid integer: " + split.join("e"));
    if (split.length === 2) {
	var exp = split[1];
	if (exp[0] === "+") exp = exp.slice(1);
	exp = +exp;
	if (exp !== truncate(exp) || !isPrecise(exp)) throw new Error("Invalid integer: " + exp + " is not a valid exponent.");
	var text = split[0];
	var decimalPlace = text.indexOf(".");
	if (decimalPlace >= 0) {
	    exp -= text.length - decimalPlace - 1;
	    text = text.slice(0, decimalPlace) + text.slice(decimalPlace + 1);
	}
	if (exp < 0) throw new Error("Cannot include negative exponent part for integers");
	text += (new Array(exp + 1)).join("0");
	v = text;
    }
    var isValid = /^([0-9][0-9]*)$/.test(v);
    if (!isValid) throw new Error("Invalid integer: " + v);
    var r = [], max = v.length, l = LOG_BASE, min = max - l;
    while (max > 0) {
	r.push(+v.slice(min, max));
	min -= l;
	if (min < 0) min = 0;
	max -= l;
    }
    trim(r);
    return new BigInteger(r, sign);
}

function parseNumberValue(v) {
    if (isPrecise(v)) {
	if (v !== truncate(v)) throw new Error(v + " is not an integer.");
	return new SmallInteger(v);
    }
    return parseStringValue(v.toString());
}

function parseValue(v) {
    if (typeof v === "number") {
	return parseNumberValue(v);
    }
    if (typeof v === "string") {
	return parseStringValue(v);
    }
    return v;
}
// Pre-define numbers in range [-999,999]
for (var i = 0; i < 1000; i++) {
    Integer[i] = new SmallInteger(i);
    if (i > 0) Integer[-i] = new SmallInteger(-i);
}
// Backwards compatibility
Integer.one = Integer[1];
Integer.zero = Integer[0];
Integer.minusOne = Integer[-1];
Integer.max = max;
Integer.min = min;
Integer.gcd = gcd;
Integer.lcm = lcm;
Integer.isInstance = function (x) { return x instanceof BigInteger || x instanceof SmallInteger; };
Integer.randBetween = randBetween;

Integer.fromArray = function (digits, base, isNegative) {
    return parseBaseFromArray(digits.map(parseValue), parseValue(base || 10), isNegative);
};

return Integer;
})();

// Node.js check
if (typeof module !== "undefined" && module.hasOwnProperty("exports")) {
    module.exports = bigInt;
}

//amd check
if (typeof define === "function" && define.amd) {
    define("big-integer", [], function () {
	return bigInt;
    });
}

//sjcl.js
"use strict";var sjcl={cipher:{},hash:{},keyexchange:{},mode:{},misc:{},codec:{},exception:{corrupt:function(a){this.toString=function(){return"CORRUPT: "+this.message};this.message=a},invalid:function(a){this.toString=function(){return"INVALID: "+this.message};this.message=a},bug:function(a){this.toString=function(){return"BUG: "+this.message};this.message=a},notReady:function(a){this.toString=function(){return"NOT READY: "+this.message};this.message=a}}};
sjcl.cipher.aes=function(a){this.s[0][0][0]||this.O();var b,c,d,e,f=this.s[0][4],g=this.s[1];b=a.length;var h=1;if(4!==b&&6!==b&&8!==b)throw new sjcl.exception.invalid("invalid aes key size");this.b=[d=a.slice(0),e=[]];for(a=b;a<4*b+28;a++){c=d[a-1];if(0===a%b||8===b&&4===a%b)c=f[c>>>24]<<24^f[c>>16&255]<<16^f[c>>8&255]<<8^f[c&255],0===a%b&&(c=c<<8^c>>>24^h<<24,h=h<<1^283*(h>>7));d[a]=d[a-b]^c}for(b=0;a;b++,a--)c=d[b&3?a:a-4],e[b]=4>=a||4>b?c:g[0][f[c>>>24]]^g[1][f[c>>16&255]]^g[2][f[c>>8&255]]^g[3][f[c&
255]]};
sjcl.cipher.aes.prototype={encrypt:function(a){return t(this,a,0)},decrypt:function(a){return t(this,a,1)},s:[[[],[],[],[],[]],[[],[],[],[],[]]],O:function(){var a=this.s[0],b=this.s[1],c=a[4],d=b[4],e,f,g,h=[],k=[],l,n,m,p;for(e=0;0x100>e;e++)k[(h[e]=e<<1^283*(e>>7))^e]=e;for(f=g=0;!c[f];f^=l||1,g=k[g]||1)for(m=g^g<<1^g<<2^g<<3^g<<4,m=m>>8^m&255^99,c[f]=m,d[m]=f,n=h[e=h[l=h[f]]],p=0x1010101*n^0x10001*e^0x101*l^0x1010100*f,n=0x101*h[m]^0x1010100*m,e=0;4>e;e++)a[e][f]=n=n<<24^n>>>8,b[e][m]=p=p<<24^p>>>8;for(e=
0;5>e;e++)a[e]=a[e].slice(0),b[e]=b[e].slice(0)}};
function t(a,b,c){if(4!==b.length)throw new sjcl.exception.invalid("invalid aes block size");var d=a.b[c],e=b[0]^d[0],f=b[c?3:1]^d[1],g=b[2]^d[2];b=b[c?1:3]^d[3];var h,k,l,n=d.length/4-2,m,p=4,r=[0,0,0,0];h=a.s[c];a=h[0];var q=h[1],v=h[2],w=h[3],x=h[4];for(m=0;m<n;m++)h=a[e>>>24]^q[f>>16&255]^v[g>>8&255]^w[b&255]^d[p],k=a[f>>>24]^q[g>>16&255]^v[b>>8&255]^w[e&255]^d[p+1],l=a[g>>>24]^q[b>>16&255]^v[e>>8&255]^w[f&255]^d[p+2],b=a[b>>>24]^q[e>>16&255]^v[f>>8&255]^w[g&255]^d[p+3],p+=4,e=h,f=k,g=l;for(m=
0;4>m;m++)r[c?3&-m:m]=x[e>>>24]<<24^x[f>>16&255]<<16^x[g>>8&255]<<8^x[b&255]^d[p++],h=e,e=f,f=g,g=b,b=h;return r}
sjcl.bitArray={bitSlice:function(a,b,c){a=sjcl.bitArray.$(a.slice(b/32),32-(b&31)).slice(1);return void 0===c?a:sjcl.bitArray.clamp(a,c-b)},extract:function(a,b,c){var d=Math.floor(-b-c&31);return((b+c-1^b)&-32?a[b/32|0]<<32-d^a[b/32+1|0]>>>d:a[b/32|0]>>>d)&(1<<c)-1},concat:function(a,b){if(0===a.length||0===b.length)return a.concat(b);var c=a[a.length-1],d=sjcl.bitArray.getPartial(c);return 32===d?a.concat(b):sjcl.bitArray.$(b,d,c|0,a.slice(0,a.length-1))},bitLength:function(a){var b=a.length;return 0===
b?0:32*(b-1)+sjcl.bitArray.getPartial(a[b-1])},clamp:function(a,b){if(32*a.length<b)return a;a=a.slice(0,Math.ceil(b/32));var c=a.length;b=b&31;0<c&&b&&(a[c-1]=sjcl.bitArray.partial(b,a[c-1]&2147483648>>b-1,1));return a},partial:function(a,b,c){return 32===a?b:(c?b|0:b<<32-a)+0x10000000000*a},getPartial:function(a){return Math.round(a/0x10000000000)||32},equal:function(a,b){if(sjcl.bitArray.bitLength(a)!==sjcl.bitArray.bitLength(b))return!1;var c=0,d;for(d=0;d<a.length;d++)c|=a[d]^b[d];return 0===
c},$:function(a,b,c,d){var e;e=0;for(void 0===d&&(d=[]);32<=b;b-=32)d.push(c),c=0;if(0===b)return d.concat(a);for(e=0;e<a.length;e++)d.push(c|a[e]>>>b),c=a[e]<<32-b;e=a.length?a[a.length-1]:0;a=sjcl.bitArray.getPartial(e);d.push(sjcl.bitArray.partial(b+a&31,32<b+a?c:d.pop(),1));return d},i:function(a,b){return[a[0]^b[0],a[1]^b[1],a[2]^b[2],a[3]^b[3]]},byteswapM:function(a){var b,c;for(b=0;b<a.length;++b)c=a[b],a[b]=c>>>24|c>>>8&0xff00|(c&0xff00)<<8|c<<24;return a}};
sjcl.codec.utf8String={fromBits:function(a){var b="",c=sjcl.bitArray.bitLength(a),d,e;for(d=0;d<c/8;d++)0===(d&3)&&(e=a[d/4]),b+=String.fromCharCode(e>>>8>>>8>>>8),e<<=8;return decodeURIComponent(escape(b))},toBits:function(a){a=unescape(encodeURIComponent(a));var b=[],c,d=0;for(c=0;c<a.length;c++)d=d<<8|a.charCodeAt(c),3===(c&3)&&(b.push(d),d=0);c&3&&b.push(sjcl.bitArray.partial(8*(c&3),d));return b}};
sjcl.codec.hex={fromBits:function(a){var b="",c;for(c=0;c<a.length;c++)b+=((a[c]|0)+0xf00000000000).toString(16).substr(4);return b.substr(0,sjcl.bitArray.bitLength(a)/4)},toBits:function(a){var b,c=[],d;a=a.replace(/\s|0x/g,"");d=a.length;a=a+"00000000";for(b=0;b<a.length;b+=8)c.push(parseInt(a.substr(b,8),16)^0);return sjcl.bitArray.clamp(c,4*d)}};
sjcl.codec.base32={B:"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",X:"0123456789ABCDEFGHIJKLMNOPQRSTUV",BITS:32,BASE:5,REMAINING:27,fromBits:function(a,b,c){var d=sjcl.codec.base32.BASE,e=sjcl.codec.base32.REMAINING,f="",g=0,h=sjcl.codec.base32.B,k=0,l=sjcl.bitArray.bitLength(a);c&&(h=sjcl.codec.base32.X);for(c=0;f.length*d<l;)f+=h.charAt((k^a[c]>>>g)>>>e),g<d?(k=a[c]<<d-g,g+=e,c++):(k<<=d,g-=d);for(;f.length&7&&!b;)f+="=";return f},toBits:function(a,b){a=a.replace(/\s|=/g,"").toUpperCase();var c=sjcl.codec.base32.BITS,
d=sjcl.codec.base32.BASE,e=sjcl.codec.base32.REMAINING,f=[],g,h=0,k=sjcl.codec.base32.B,l=0,n,m="base32";b&&(k=sjcl.codec.base32.X,m="base32hex");for(g=0;g<a.length;g++){n=k.indexOf(a.charAt(g));if(0>n){if(!b)try{return sjcl.codec.base32hex.toBits(a)}catch(p){}throw new sjcl.exception.invalid("this isn't "+m+"!");}h>e?(h-=e,f.push(l^n>>>h),l=n<<c-h):(h+=d,l^=n<<c-h)}h&56&&f.push(sjcl.bitArray.partial(h&56,l,1));return f}};
sjcl.codec.base32hex={fromBits:function(a,b){return sjcl.codec.base32.fromBits(a,b,1)},toBits:function(a){return sjcl.codec.base32.toBits(a,1)}};
sjcl.codec.base64={B:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",fromBits:function(a,b,c){var d="",e=0,f=sjcl.codec.base64.B,g=0,h=sjcl.bitArray.bitLength(a);c&&(f=f.substr(0,62)+"-_");for(c=0;6*d.length<h;)d+=f.charAt((g^a[c]>>>e)>>>26),6>e?(g=a[c]<<6-e,e+=26,c++):(g<<=6,e-=6);for(;d.length&3&&!b;)d+="=";return d},toBits:function(a,b){a=a.replace(/\s|=/g,"");var c=[],d,e=0,f=sjcl.codec.base64.B,g=0,h;b&&(f=f.substr(0,62)+"-_");for(d=0;d<a.length;d++){h=f.indexOf(a.charAt(d));
if(0>h)throw new sjcl.exception.invalid("this isn't base64!");26<e?(e-=26,c.push(g^h>>>e),g=h<<32-e):(e+=6,g^=h<<32-e)}e&56&&c.push(sjcl.bitArray.partial(e&56,g,1));return c}};sjcl.codec.base64url={fromBits:function(a){return sjcl.codec.base64.fromBits(a,1,1)},toBits:function(a){return sjcl.codec.base64.toBits(a,1)}};sjcl.hash.sha256=function(a){this.b[0]||this.O();a?(this.F=a.F.slice(0),this.A=a.A.slice(0),this.l=a.l):this.reset()};sjcl.hash.sha256.hash=function(a){return(new sjcl.hash.sha256).update(a).finalize()};
sjcl.hash.sha256.prototype={blockSize:512,reset:function(){this.F=this.Y.slice(0);this.A=[];this.l=0;return this},update:function(a){"string"===typeof a&&(a=sjcl.codec.utf8String.toBits(a));var b,c=this.A=sjcl.bitArray.concat(this.A,a);b=this.l;a=this.l=b+sjcl.bitArray.bitLength(a);if(0x1fffffffffffff<a)throw new sjcl.exception.invalid("Cannot hash more than 2^53 - 1 bits");if("undefined"!==typeof Uint32Array){var d=new Uint32Array(c),e=0;for(b=512+b-(512+b&0x1ff);b<=a;b+=512)u(this,d.subarray(16*e,
16*(e+1))),e+=1;c.splice(0,16*e)}else for(b=512+b-(512+b&0x1ff);b<=a;b+=512)u(this,c.splice(0,16));return this},finalize:function(){var a,b=this.A,c=this.F,b=sjcl.bitArray.concat(b,[sjcl.bitArray.partial(1,1)]);for(a=b.length+2;a&15;a++)b.push(0);b.push(Math.floor(this.l/0x100000000));for(b.push(this.l|0);b.length;)u(this,b.splice(0,16));this.reset();return c},Y:[],b:[],O:function(){function a(a){return 0x100000000*(a-Math.floor(a))|0}for(var b=0,c=2,d,e;64>b;c++){e=!0;for(d=2;d*d<=c;d++)if(0===c%d){e=
!1;break}e&&(8>b&&(this.Y[b]=a(Math.pow(c,.5))),this.b[b]=a(Math.pow(c,1/3)),b++)}}};
function u(a,b){var c,d,e,f=a.F,g=a.b,h=f[0],k=f[1],l=f[2],n=f[3],m=f[4],p=f[5],r=f[6],q=f[7];for(c=0;64>c;c++)16>c?d=b[c]:(d=b[c+1&15],e=b[c+14&15],d=b[c&15]=(d>>>7^d>>>18^d>>>3^d<<25^d<<14)+(e>>>17^e>>>19^e>>>10^e<<15^e<<13)+b[c&15]+b[c+9&15]|0),d=d+q+(m>>>6^m>>>11^m>>>25^m<<26^m<<21^m<<7)+(r^m&(p^r))+g[c],q=r,r=p,p=m,m=n+d|0,n=l,l=k,k=h,h=d+(k&l^n&(k^l))+(k>>>2^k>>>13^k>>>22^k<<30^k<<19^k<<10)|0;f[0]=f[0]+h|0;f[1]=f[1]+k|0;f[2]=f[2]+l|0;f[3]=f[3]+n|0;f[4]=f[4]+m|0;f[5]=f[5]+p|0;f[6]=f[6]+r|0;f[7]=
f[7]+q|0}
sjcl.mode.ccm={name:"ccm",G:[],listenProgress:function(a){sjcl.mode.ccm.G.push(a)},unListenProgress:function(a){a=sjcl.mode.ccm.G.indexOf(a);-1<a&&sjcl.mode.ccm.G.splice(a,1)},fa:function(a){var b=sjcl.mode.ccm.G.slice(),c;for(c=0;c<b.length;c+=1)b[c](a)},encrypt:function(a,b,c,d,e){var f,g=b.slice(0),h=sjcl.bitArray,k=h.bitLength(c)/8,l=h.bitLength(g)/8;e=e||64;d=d||[];if(7>k)throw new sjcl.exception.invalid("ccm: iv must be at least 7 bytes");for(f=2;4>f&&l>>>8*f;f++);f<15-k&&(f=15-k);c=h.clamp(c,
8*(15-f));b=sjcl.mode.ccm.V(a,b,c,d,e,f);g=sjcl.mode.ccm.C(a,g,c,b,e,f);return h.concat(g.data,g.tag)},decrypt:function(a,b,c,d,e){e=e||64;d=d||[];var f=sjcl.bitArray,g=f.bitLength(c)/8,h=f.bitLength(b),k=f.clamp(b,h-e),l=f.bitSlice(b,h-e),h=(h-e)/8;if(7>g)throw new sjcl.exception.invalid("ccm: iv must be at least 7 bytes");for(b=2;4>b&&h>>>8*b;b++);b<15-g&&(b=15-g);c=f.clamp(c,8*(15-b));k=sjcl.mode.ccm.C(a,k,c,l,e,b);a=sjcl.mode.ccm.V(a,k.data,c,d,e,b);if(!f.equal(k.tag,a))throw new sjcl.exception.corrupt("ccm: tag doesn't match");
return k.data},na:function(a,b,c,d,e,f){var g=[],h=sjcl.bitArray,k=h.i;d=[h.partial(8,(b.length?64:0)|d-2<<2|f-1)];d=h.concat(d,c);d[3]|=e;d=a.encrypt(d);if(b.length)for(c=h.bitLength(b)/8,65279>=c?g=[h.partial(16,c)]:0xffffffff>=c&&(g=h.concat([h.partial(16,65534)],[c])),g=h.concat(g,b),b=0;b<g.length;b+=4)d=a.encrypt(k(d,g.slice(b,b+4).concat([0,0,0])));return d},V:function(a,b,c,d,e,f){var g=sjcl.bitArray,h=g.i;e/=8;if(e%2||4>e||16<e)throw new sjcl.exception.invalid("ccm: invalid tag length");
if(0xffffffff<d.length||0xffffffff<b.length)throw new sjcl.exception.bug("ccm: can't deal with 4GiB or more data");c=sjcl.mode.ccm.na(a,d,c,e,g.bitLength(b)/8,f);for(d=0;d<b.length;d+=4)c=a.encrypt(h(c,b.slice(d,d+4).concat([0,0,0])));return g.clamp(c,8*e)},C:function(a,b,c,d,e,f){var g,h=sjcl.bitArray;g=h.i;var k=b.length,l=h.bitLength(b),n=k/50,m=n;c=h.concat([h.partial(8,f-1)],c).concat([0,0,0]).slice(0,4);d=h.bitSlice(g(d,a.encrypt(c)),0,e);if(!k)return{tag:d,data:[]};for(g=0;g<k;g+=4)g>n&&(sjcl.mode.ccm.fa(g/
k),n+=m),c[3]++,e=a.encrypt(c),b[g]^=e[0],b[g+1]^=e[1],b[g+2]^=e[2],b[g+3]^=e[3];return{tag:d,data:h.clamp(b,l)}}};
sjcl.mode.ocb2={name:"ocb2",encrypt:function(a,b,c,d,e,f){if(128!==sjcl.bitArray.bitLength(c))throw new sjcl.exception.invalid("ocb iv must be 128 bits");var g,h=sjcl.mode.ocb2.S,k=sjcl.bitArray,l=k.i,n=[0,0,0,0];c=h(a.encrypt(c));var m,p=[];d=d||[];e=e||64;for(g=0;g+4<b.length;g+=4)m=b.slice(g,g+4),n=l(n,m),p=p.concat(l(c,a.encrypt(l(c,m)))),c=h(c);m=b.slice(g);b=k.bitLength(m);g=a.encrypt(l(c,[0,0,0,b]));m=k.clamp(l(m.concat([0,0,0]),g),b);n=l(n,l(m.concat([0,0,0]),g));n=a.encrypt(l(n,l(c,h(c))));
d.length&&(n=l(n,f?d:sjcl.mode.ocb2.pmac(a,d)));return p.concat(k.concat(m,k.clamp(n,e)))},decrypt:function(a,b,c,d,e,f){if(128!==sjcl.bitArray.bitLength(c))throw new sjcl.exception.invalid("ocb iv must be 128 bits");e=e||64;var g=sjcl.mode.ocb2.S,h=sjcl.bitArray,k=h.i,l=[0,0,0,0],n=g(a.encrypt(c)),m,p,r=sjcl.bitArray.bitLength(b)-e,q=[];d=d||[];for(c=0;c+4<r/32;c+=4)m=k(n,a.decrypt(k(n,b.slice(c,c+4)))),l=k(l,m),q=q.concat(m),n=g(n);p=r-32*c;m=a.encrypt(k(n,[0,0,0,p]));m=k(m,h.clamp(b.slice(c),p).concat([0,
0,0]));l=k(l,m);l=a.encrypt(k(l,k(n,g(n))));d.length&&(l=k(l,f?d:sjcl.mode.ocb2.pmac(a,d)));if(!h.equal(h.clamp(l,e),h.bitSlice(b,r)))throw new sjcl.exception.corrupt("ocb: tag doesn't match");return q.concat(h.clamp(m,p))},pmac:function(a,b){var c,d=sjcl.mode.ocb2.S,e=sjcl.bitArray,f=e.i,g=[0,0,0,0],h=a.encrypt([0,0,0,0]),h=f(h,d(d(h)));for(c=0;c+4<b.length;c+=4)h=d(h),g=f(g,a.encrypt(f(h,b.slice(c,c+4))));c=b.slice(c);128>e.bitLength(c)&&(h=f(h,d(h)),c=e.concat(c,[-2147483648,0,0,0]));g=f(g,c);
return a.encrypt(f(d(f(h,d(h))),g))},S:function(a){return[a[0]<<1^a[1]>>>31,a[1]<<1^a[2]>>>31,a[2]<<1^a[3]>>>31,a[3]<<1^135*(a[0]>>>31)]}};
sjcl.mode.gcm={name:"gcm",encrypt:function(a,b,c,d,e){var f=b.slice(0);b=sjcl.bitArray;d=d||[];a=sjcl.mode.gcm.C(!0,a,f,d,c,e||128);return b.concat(a.data,a.tag)},decrypt:function(a,b,c,d,e){var f=b.slice(0),g=sjcl.bitArray,h=g.bitLength(f);e=e||128;d=d||[];e<=h?(b=g.bitSlice(f,h-e),f=g.bitSlice(f,0,h-e)):(b=f,f=[]);a=sjcl.mode.gcm.C(!1,a,f,d,c,e);if(!g.equal(a.tag,b))throw new sjcl.exception.corrupt("gcm: tag doesn't match");return a.data},ka:function(a,b){var c,d,e,f,g,h=sjcl.bitArray.i;e=[0,0,
0,0];f=b.slice(0);for(c=0;128>c;c++){(d=0!==(a[Math.floor(c/32)]&1<<31-c%32))&&(e=h(e,f));g=0!==(f[3]&1);for(d=3;0<d;d--)f[d]=f[d]>>>1|(f[d-1]&1)<<31;f[0]>>>=1;g&&(f[0]^=-0x1f000000)}return e},j:function(a,b,c){var d,e=c.length;b=b.slice(0);for(d=0;d<e;d+=4)b[0]^=0xffffffff&c[d],b[1]^=0xffffffff&c[d+1],b[2]^=0xffffffff&c[d+2],b[3]^=0xffffffff&c[d+3],b=sjcl.mode.gcm.ka(b,a);return b},C:function(a,b,c,d,e,f){var g,h,k,l,n,m,p,r,q=sjcl.bitArray;m=c.length;p=q.bitLength(c);r=q.bitLength(d);h=q.bitLength(e);
g=b.encrypt([0,0,0,0]);96===h?(e=e.slice(0),e=q.concat(e,[1])):(e=sjcl.mode.gcm.j(g,[0,0,0,0],e),e=sjcl.mode.gcm.j(g,e,[0,0,Math.floor(h/0x100000000),h&0xffffffff]));h=sjcl.mode.gcm.j(g,[0,0,0,0],d);n=e.slice(0);d=h.slice(0);a||(d=sjcl.mode.gcm.j(g,h,c));for(l=0;l<m;l+=4)n[3]++,k=b.encrypt(n),c[l]^=k[0],c[l+1]^=k[1],c[l+2]^=k[2],c[l+3]^=k[3];c=q.clamp(c,p);a&&(d=sjcl.mode.gcm.j(g,h,c));a=[Math.floor(r/0x100000000),r&0xffffffff,Math.floor(p/0x100000000),p&0xffffffff];d=sjcl.mode.gcm.j(g,d,a);k=b.encrypt(e);
d[0]^=k[0];d[1]^=k[1];d[2]^=k[2];d[3]^=k[3];return{tag:q.bitSlice(d,0,f),data:c}}};sjcl.misc.hmac=function(a,b){this.W=b=b||sjcl.hash.sha256;var c=[[],[]],d,e=b.prototype.blockSize/32;this.w=[new b,new b];a.length>e&&(a=b.hash(a));for(d=0;d<e;d++)c[0][d]=a[d]^909522486,c[1][d]=a[d]^1549556828;this.w[0].update(c[0]);this.w[1].update(c[1]);this.R=new b(this.w[0])};
sjcl.misc.hmac.prototype.encrypt=sjcl.misc.hmac.prototype.mac=function(a){if(this.aa)throw new sjcl.exception.invalid("encrypt on already updated hmac called!");this.update(a);return this.digest(a)};sjcl.misc.hmac.prototype.reset=function(){this.R=new this.W(this.w[0]);this.aa=!1};sjcl.misc.hmac.prototype.update=function(a){this.aa=!0;this.R.update(a)};sjcl.misc.hmac.prototype.digest=function(){var a=this.R.finalize(),a=(new this.W(this.w[1])).update(a).finalize();this.reset();return a};
sjcl.misc.pbkdf2=function(a,b,c,d,e){c=c||1E4;if(0>d||0>c)throw new sjcl.exception.invalid("invalid params to pbkdf2");"string"===typeof a&&(a=sjcl.codec.utf8String.toBits(a));"string"===typeof b&&(b=sjcl.codec.utf8String.toBits(b));e=e||sjcl.misc.hmac;a=new e(a);var f,g,h,k,l=[],n=sjcl.bitArray;for(k=1;32*l.length<(d||1);k++){e=f=a.encrypt(n.concat(b,[k]));for(g=1;g<c;g++)for(f=a.encrypt(f),h=0;h<f.length;h++)e[h]^=f[h];l=l.concat(e)}d&&(l=n.clamp(l,d));return l};
sjcl.prng=function(a){this.c=[new sjcl.hash.sha256];this.m=[0];this.P=0;this.H={};this.N=0;this.U={};this.Z=this.f=this.o=this.ha=0;this.b=[0,0,0,0,0,0,0,0];this.h=[0,0,0,0];this.L=void 0;this.M=a;this.D=!1;this.K={progress:{},seeded:{}};this.u=this.ga=0;this.I=1;this.J=2;this.ca=0x10000;this.T=[0,48,64,96,128,192,0x100,384,512,768,1024];this.da=3E4;this.ba=80};
sjcl.prng.prototype={randomWords:function(a,b){var c=[],d;d=this.isReady(b);var e;if(d===this.u)throw new sjcl.exception.notReady("generator isn't seeded");if(d&this.J){d=!(d&this.I);e=[];var f=0,g;this.Z=e[0]=(new Date).valueOf()+this.da;for(g=0;16>g;g++)e.push(0x100000000*Math.random()|0);for(g=0;g<this.c.length&&(e=e.concat(this.c[g].finalize()),f+=this.m[g],this.m[g]=0,d||!(this.P&1<<g));g++);this.P>=1<<this.c.length&&(this.c.push(new sjcl.hash.sha256),this.m.push(0));this.f-=f;f>this.o&&(this.o=
f);this.P++;this.b=sjcl.hash.sha256.hash(this.b.concat(e));this.L=new sjcl.cipher.aes(this.b);for(d=0;4>d&&(this.h[d]=this.h[d]+1|0,!this.h[d]);d++);}for(d=0;d<a;d+=4)0===(d+1)%this.ca&&y(this),e=z(this),c.push(e[0],e[1],e[2],e[3]);y(this);return c.slice(0,a)},setDefaultParanoia:function(a,b){if(0===a&&"Setting paranoia=0 will ruin your security; use it only for testing"!==b)throw new sjcl.exception.invalid("Setting paranoia=0 will ruin your security; use it only for testing");this.M=a},addEntropy:function(a,
b,c){c=c||"user";var d,e,f=(new Date).valueOf(),g=this.H[c],h=this.isReady(),k=0;d=this.U[c];void 0===d&&(d=this.U[c]=this.ha++);void 0===g&&(g=this.H[c]=0);this.H[c]=(this.H[c]+1)%this.c.length;switch(typeof a){case "number":void 0===b&&(b=1);this.c[g].update([d,this.N++,1,b,f,1,a|0]);break;case "object":c=Object.prototype.toString.call(a);if("[object Uint32Array]"===c){e=[];for(c=0;c<a.length;c++)e.push(a[c]);a=e}else for("[object Array]"!==c&&(k=1),c=0;c<a.length&&!k;c++)"number"!==typeof a[c]&&
(k=1);if(!k){if(void 0===b)for(c=b=0;c<a.length;c++)for(e=a[c];0<e;)b++,e=e>>>1;this.c[g].update([d,this.N++,2,b,f,a.length].concat(a))}break;case "string":void 0===b&&(b=a.length);this.c[g].update([d,this.N++,3,b,f,a.length]);this.c[g].update(a);break;default:k=1}if(k)throw new sjcl.exception.bug("random: addEntropy only supports number, array of numbers or string");this.m[g]+=b;this.f+=b;h===this.u&&(this.isReady()!==this.u&&A("seeded",Math.max(this.o,this.f)),A("progress",this.getProgress()))},
isReady:function(a){a=this.T[void 0!==a?a:this.M];return this.o&&this.o>=a?this.m[0]>this.ba&&(new Date).valueOf()>this.Z?this.J|this.I:this.I:this.f>=a?this.J|this.u:this.u},getProgress:function(a){a=this.T[a?a:this.M];return this.o>=a?1:this.f>a?1:this.f/a},startCollectors:function(){if(!this.D){this.a={loadTimeCollector:B(this,this.ma),mouseCollector:B(this,this.oa),keyboardCollector:B(this,this.la),accelerometerCollector:B(this,this.ea),touchCollector:B(this,this.qa)};if(window.addEventListener)window.addEventListener("load",
this.a.loadTimeCollector,!1),window.addEventListener("mousemove",this.a.mouseCollector,!1),window.addEventListener("keypress",this.a.keyboardCollector,!1),window.addEventListener("devicemotion",this.a.accelerometerCollector,!1),window.addEventListener("touchmove",this.a.touchCollector,!1);else if(document.attachEvent)document.attachEvent("onload",this.a.loadTimeCollector),document.attachEvent("onmousemove",this.a.mouseCollector),document.attachEvent("keypress",this.a.keyboardCollector);else throw new sjcl.exception.bug("can't attach event");
this.D=!0}},stopCollectors:function(){this.D&&(window.removeEventListener?(window.removeEventListener("load",this.a.loadTimeCollector,!1),window.removeEventListener("mousemove",this.a.mouseCollector,!1),window.removeEventListener("keypress",this.a.keyboardCollector,!1),window.removeEventListener("devicemotion",this.a.accelerometerCollector,!1),window.removeEventListener("touchmove",this.a.touchCollector,!1)):document.detachEvent&&(document.detachEvent("onload",this.a.loadTimeCollector),document.detachEvent("onmousemove",
this.a.mouseCollector),document.detachEvent("keypress",this.a.keyboardCollector)),this.D=!1)},addEventListener:function(a,b){this.K[a][this.ga++]=b},removeEventListener:function(a,b){var c,d,e=this.K[a],f=[];for(d in e)e.hasOwnProperty(d)&&e[d]===b&&f.push(d);for(c=0;c<f.length;c++)d=f[c],delete e[d]},la:function(){C(this,1)},oa:function(a){var b,c;try{b=a.x||a.clientX||a.offsetX||0,c=a.y||a.clientY||a.offsetY||0}catch(d){c=b=0}0!=b&&0!=c&&this.addEntropy([b,c],2,"mouse");C(this,0)},qa:function(a){a=
a.touches[0]||a.changedTouches[0];this.addEntropy([a.pageX||a.clientX,a.pageY||a.clientY],1,"touch");C(this,0)},ma:function(){C(this,2)},ea:function(a){a=a.accelerationIncludingGravity.x||a.accelerationIncludingGravity.y||a.accelerationIncludingGravity.z;if(window.orientation){var b=window.orientation;"number"===typeof b&&this.addEntropy(b,1,"accelerometer")}a&&this.addEntropy(a,2,"accelerometer");C(this,0)}};
function A(a,b){var c,d=sjcl.random.K[a],e=[];for(c in d)d.hasOwnProperty(c)&&e.push(d[c]);for(c=0;c<e.length;c++)e[c](b)}function C(a,b){"undefined"!==typeof window&&window.performance&&"function"===typeof window.performance.now?a.addEntropy(window.performance.now(),b,"loadtime"):a.addEntropy((new Date).valueOf(),b,"loadtime")}function y(a){a.b=z(a).concat(z(a));a.L=new sjcl.cipher.aes(a.b)}function z(a){for(var b=0;4>b&&(a.h[b]=a.h[b]+1|0,!a.h[b]);b++);return a.L.encrypt(a.h)}
function B(a,b){return function(){b.apply(a,arguments)}}sjcl.random=new sjcl.prng(6);
a:try{var D,E,F,G;if(G="undefined"!==typeof module&&module.exports){var H;try{H=require("crypto")}catch(a){H=null}G=E=H}if(G&&E.randomBytes)D=E.randomBytes(128),D=new Uint32Array((new Uint8Array(D)).buffer),sjcl.random.addEntropy(D,1024,"crypto['randomBytes']");else if("undefined"!==typeof window&&"undefined"!==typeof Uint32Array){F=new Uint32Array(32);if(window.crypto&&window.crypto.getRandomValues)window.crypto.getRandomValues(F);else if(window.msCrypto&&window.msCrypto.getRandomValues)window.msCrypto.getRandomValues(F);
else break a;sjcl.random.addEntropy(F,1024,"crypto['getRandomValues']")}}catch(a){"undefined"!==typeof window&&window.console&&(console.log("There was an error collecting entropy from the browser:"),console.log(a))}
sjcl.json={defaults:{v:1,iter:1E4,ks:128,ts:64,mode:"ccm",adata:"",cipher:"aes"},ja:function(a,b,c,d){c=c||{};d=d||{};var e=sjcl.json,f=e.g({iv:sjcl.random.randomWords(4,0)},e.defaults),g;e.g(f,c);c=f.adata;"string"===typeof f.salt&&(f.salt=sjcl.codec.base64.toBits(f.salt));"string"===typeof f.iv&&(f.iv=sjcl.codec.base64.toBits(f.iv));if(!sjcl.mode[f.mode]||!sjcl.cipher[f.cipher]||"string"===typeof a&&100>=f.iter||64!==f.ts&&96!==f.ts&&128!==f.ts||128!==f.ks&&192!==f.ks&&0x100!==f.ks||2>f.iv.length||
4<f.iv.length)throw new sjcl.exception.invalid("json encrypt: invalid parameters");"string"===typeof a?(g=sjcl.misc.cachedPbkdf2(a,f),a=g.key.slice(0,f.ks/32),f.salt=g.salt):sjcl.ecc&&a instanceof sjcl.ecc.elGamal.publicKey&&(g=a.kem(),f.kemtag=g.tag,a=g.key.slice(0,f.ks/32));"string"===typeof b&&(b=sjcl.codec.utf8String.toBits(b));"string"===typeof c&&(f.adata=c=sjcl.codec.utf8String.toBits(c));g=new sjcl.cipher[f.cipher](a);e.g(d,f);d.key=a;f.ct="ccm"===f.mode&&sjcl.arrayBuffer&&sjcl.arrayBuffer.ccm&&
b instanceof ArrayBuffer?sjcl.arrayBuffer.ccm.encrypt(g,b,f.iv,c,f.ts):sjcl.mode[f.mode].encrypt(g,b,f.iv,c,f.ts);return f},encrypt:function(a,b,c,d){var e=sjcl.json,f=e.ja.apply(e,arguments);return e.encode(f)},ia:function(a,b,c,d){c=c||{};d=d||{};var e=sjcl.json;b=e.g(e.g(e.g({},e.defaults),b),c,!0);var f,g;f=b.adata;"string"===typeof b.salt&&(b.salt=sjcl.codec.base64.toBits(b.salt));"string"===typeof b.iv&&(b.iv=sjcl.codec.base64.toBits(b.iv));if(!sjcl.mode[b.mode]||!sjcl.cipher[b.cipher]||"string"===
typeof a&&100>=b.iter||64!==b.ts&&96!==b.ts&&128!==b.ts||128!==b.ks&&192!==b.ks&&0x100!==b.ks||!b.iv||2>b.iv.length||4<b.iv.length)throw new sjcl.exception.invalid("json decrypt: invalid parameters");"string"===typeof a?(g=sjcl.misc.cachedPbkdf2(a,b),a=g.key.slice(0,b.ks/32),b.salt=g.salt):sjcl.ecc&&a instanceof sjcl.ecc.elGamal.secretKey&&(a=a.unkem(sjcl.codec.base64.toBits(b.kemtag)).slice(0,b.ks/32));"string"===typeof f&&(f=sjcl.codec.utf8String.toBits(f));g=new sjcl.cipher[b.cipher](a);f="ccm"===
b.mode&&sjcl.arrayBuffer&&sjcl.arrayBuffer.ccm&&b.ct instanceof ArrayBuffer?sjcl.arrayBuffer.ccm.decrypt(g,b.ct,b.iv,b.tag,f,b.ts):sjcl.mode[b.mode].decrypt(g,b.ct,b.iv,f,b.ts);e.g(d,b);d.key=a;return 1===c.raw?f:sjcl.codec.utf8String.fromBits(f)},decrypt:function(a,b,c,d){var e=sjcl.json;return e.ia(a,e.decode(b),c,d)},encode:function(a){var b,c="{",d="";for(b in a)if(a.hasOwnProperty(b)){if(!b.match(/^[a-z0-9]+$/i))throw new sjcl.exception.invalid("json encode: invalid property name");c+=d+'"'+
b+'":';d=",";switch(typeof a[b]){case "number":case "boolean":c+=a[b];break;case "string":c+='"'+escape(a[b])+'"';break;case "object":c+='"'+sjcl.codec.base64.fromBits(a[b],0)+'"';break;default:throw new sjcl.exception.bug("json encode: unsupported type");}}return c+"}"},decode:function(a){a=a.replace(/\s/g,"");if(!a.match(/^\{.*\}$/))throw new sjcl.exception.invalid("json decode: this isn't json!");a=a.replace(/^\{|\}$/g,"").split(/,/);var b={},c,d;for(c=0;c<a.length;c++){if(!(d=a[c].match(/^\s*(?:(["']?)([a-z][a-z0-9]*)\1)\s*:\s*(?:(-?\d+)|"([a-z0-9+\/%*_.@=\-]*)"|(true|false))$/i)))throw new sjcl.exception.invalid("json decode: this isn't json!");
null!=d[3]?b[d[2]]=parseInt(d[3],10):null!=d[4]?b[d[2]]=d[2].match(/^(ct|adata|salt|iv)$/)?sjcl.codec.base64.toBits(d[4]):unescape(d[4]):null!=d[5]&&(b[d[2]]="true"===d[5])}return b},g:function(a,b,c){void 0===a&&(a={});if(void 0===b)return a;for(var d in b)if(b.hasOwnProperty(d)){if(c&&void 0!==a[d]&&a[d]!==b[d])throw new sjcl.exception.invalid("required parameter overridden");a[d]=b[d]}return a},sa:function(a,b){var c={},d;for(d in a)a.hasOwnProperty(d)&&a[d]!==b[d]&&(c[d]=a[d]);return c},ra:function(a,
b){var c={},d;for(d=0;d<b.length;d++)void 0!==a[b[d]]&&(c[b[d]]=a[b[d]]);return c}};sjcl.encrypt=sjcl.json.encrypt;sjcl.decrypt=sjcl.json.decrypt;sjcl.misc.pa={};sjcl.misc.cachedPbkdf2=function(a,b){var c=sjcl.misc.pa,d;b=b||{};d=b.iter||1E3;c=c[a]=c[a]||{};d=c[d]=c[d]||{firstSalt:b.salt&&b.salt.length?b.salt.slice(0):sjcl.random.randomWords(2,0)};c=void 0===b.salt?d.firstSalt:b.salt;d[c]=d[c]||sjcl.misc.pbkdf2(a,c,b.iter);return{key:d[c].slice(0),salt:c.slice(0)}};
"undefined"!==typeof module&&module.exports&&(module.exports=sjcl);"function"===typeof define&&define([],function(){return sjcl});

//sha256.js
/** @fileOverview Javascript SHA-256 implementation.
    *
    * An older version of this implementation is available in the public
    * domain, but this one is (c) Emily Stark, Mike Hamburg, Dan Boneh,
    * Stanford University 2008-2010 and BSD-licensed for liability
    * reasons.
    *
    * Special thanks to Aldo Cortesi for pointing out several bugs in
    * this code.
    *
    * @author Emily Stark
    * @author Mike Hamburg
    * @author Dan Boneh
*/
/**
 * Context for a SHA-256 operation in progress.
 * @constructor
 */
sjcl.hash.sha256 = function (hash) {
    if (!this._key[0]) { this._precompute(); }
    if (hash) {
        this._h = hash._h.slice(0);
        this._buffer = hash._buffer.slice(0);
        this._length = hash._length;
    } else {
        this.reset();
    }
};
/**
 * Hash a string or an array of words.
 * @static
 * @param {bitArray|String} data the data to hash.
 * @return {bitArray} The hash value, an array of 16 big-endian words.
 */
sjcl.hash.sha256.hash = function (data) {
    return (new sjcl.hash.sha256()).update(data).finalize();
};
sjcl.hash.sha256.prototype = {
      /**
   * The hash's block size, in bits.
   * @constant
   */
    blockSize: 512,
      /**
   * Reset the hash state.
   * @return this
   */
    reset:function () {
        this._h = this._init.slice(0);
        this._buffer = [];
        this._length = 0;
        return this;
    },
      /**
   * Input several words to the hash.
   * @param {bitArray|String} data the data to hash.
   * @return this
   */
    update: function (data) {
        if (typeof data === "string") {
            data = sjcl.codec.utf8String.toBits(data);
        }
        var i, b = this._buffer = sjcl.bitArray.concat(this._buffer, data),
            ol = this._length,
            nl = this._length = ol + sjcl.bitArray.bitLength(data);
        if (nl > 9007199254740991){
            throw new sjcl.exception.invalid("Cannot hash more than 2^53 - 1 bits");
        }
        if (typeof Uint32Array !== 'undefined') {
            var c = new Uint32Array(b);
            var j = 0;
            for (i = 512+ol - ((512+ol) & 511); i <= nl; i+= 512) {
                this._block(c.subarray(16 * j, 16 * (j+1)));
                j += 1;
            }
            b.splice(0, 16 * j);
        } else {
            for (i = 512+ol - ((512+ol) & 511); i <= nl; i+= 512) {
                this._block(b.splice(0,16));
            }
        }
        return this;
    },
      /**
   * Complete hashing and output the hash value.
   * @return {bitArray} The hash value, an array of 8 big-endian words.
   */
    finalize:function () {
        var i, b = this._buffer, h = this._h;
        // Round out and push the buffer
        b = sjcl.bitArray.concat(b, [sjcl.bitArray.partial(1,1)]);
        // Round out the buffer to a multiple of 16 words, less the 2 length words.
        for (i = b.length + 2; i & 15; i++) {
            b.push(0);
        }
        // append the length
        b.push(Math.floor(this._length / 0x100000000));
        b.push(this._length | 0);
        while (b.length) {
            this._block(b.splice(0,16));
        }
        this.reset();
        return h;
    },
      /**
   * The SHA-256 initialization vector, to be precomputed.
   * @private
   */
    _init:[],
      /*
  _init:[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],
      */
      /**
   * The SHA-256 hash key, to be precomputed.
   * @private
   */
    _key:[],
      /*
  _key:
    [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
     0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
     0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
     0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
     0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
     0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
     0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
     0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2],
      */
      /**
   * Function to precompute _init and _key.
   * @private
   */
    _precompute: function () {
        var i = 0, prime = 2, factor, isPrime;
        function frac(x) { return (x-Math.floor(x)) * 0x100000000 | 0; }
        for (; i<64; prime++) {
            isPrime = true;
            for (factor=2; factor*factor <= prime; factor++) {
                if (prime % factor === 0) {
                    isPrime = false;
                    break;
                }
            }
            if (isPrime) {
                if (i<8) {
                    this._init[i] = frac(Math.pow(prime, 1/2));
                }
                this._key[i] = frac(Math.pow(prime, 1/3));
                i++;
            }
        }
    },
      /**
   * Perform one cycle of SHA-256.
   * @param {Uint32Array|bitArray} w one block of words.
   * @private
   */
    _block:function (w) {
        var i, tmp, a, b,
            h = this._h,
            k = this._key,
            h0 = h[0], h1 = h[1], h2 = h[2], h3 = h[3],
            h4 = h[4], h5 = h[5], h6 = h[6], h7 = h[7];
            /* Rationale for placement of |0 :
     * If a value can overflow is original 32 bits by a factor of more than a few
     * million (2^23 ish), there is a possibility that it might overflow the
     * 53-bit mantissa and lose precision.
     *
     * To avoid this, we clamp back to 32 bits by |'ing with 0 on any value that
     * propagates around the loop, and on the hash state h[].  I don't believe
     * that the clamps on h4 and on h0 are strictly necessary, but it's close
     * (for h4 anyway), and better safe than sorry.
     *
     * The clamps on h[] are necessary for the output to be correct even in the
     * common case and for short inputs.
     */
        for (i=0; i<64; i++) {
            // load up the input word for this round
            if (i<16) {
                tmp = w[i];
            } else {
                a   = w[(i+1 ) & 15];
                b   = w[(i+14) & 15];
                tmp = w[i&15] = ((a>>>7  ^ a>>>18 ^ a>>>3  ^ a<<25 ^ a<<14) +
                                 (b>>>17 ^ b>>>19 ^ b>>>10 ^ b<<15 ^ b<<13) +
                                 w[i&15] + w[(i+9) & 15]) | 0;
            }
            tmp = (tmp + h7 + (h4>>>6 ^ h4>>>11 ^ h4>>>25 ^ h4<<26 ^ h4<<21 ^ h4<<7) +  (h6 ^ h4&(h5^h6)) + k[i]); // | 0;
            // shift register
            h7 = h6; h6 = h5; h5 = h4;
            h4 = h3 + tmp | 0;
            h3 = h2; h2 = h1; h1 = h0;
            h0 = (tmp +  ((h1&h2) ^ (h3&(h1^h2))) + (h1>>>2 ^ h1>>>13 ^ h1>>>22 ^ h1<<30 ^ h1<<19 ^ h1<<10)) | 0;
        }
        h[0] = h[0]+h0 | 0;
        h[1] = h[1]+h1 | 0;
        h[2] = h[2]+h2 | 0;
        h[3] = h[3]+h3 | 0;
        h[4] = h[4]+h4 | 0;
        h[5] = h[5]+h5 | 0;
        h[6] = h[6]+h6 | 0;
        h[7] = h[7]+h7 | 0;
    }
};
!function(a){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=a();else if("function"==typeof define&&define.amd)define([],a);else{var b;b="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,b.elliptic=a()}}(function(){return function a(b,c,d){function e(g,h){if(!c[g]){if(!b[g]){var i="function"==typeof require&&require;if(!h&&i)return i(g,!0);if(f)return f(g,!0);var j=new Error("Cannot find module '"+g+"'");throw j.code="MODULE_NOT_FOUND",j}var k=c[g]={exports:{}};b[g][0].call(k.exports,function(a){var c=b[g][1][a];return e(c?c:a)},k,k.exports,a,b,c,d)}return c[g].exports}for(var f="function"==typeof require&&require,g=0;g<d.length;g++)e(d[g]);return e}({1:[function(a,b,c){"use strict";var d=c;d.version=a("../package.json").version,d.utils=a("./elliptic/utils"),d.rand=a("brorand"),d.curve=a("./elliptic/curve"),d.curves=a("./elliptic/curves"),d.ec=a("./elliptic/ec"),d.eddsa=a("./elliptic/eddsa")},{"../package.json":30,"./elliptic/curve":4,"./elliptic/curves":7,"./elliptic/ec":8,"./elliptic/eddsa":11,"./elliptic/utils":15,brorand:17}],2:[function(a,b,c){"use strict";function d(a,b){this.type=a,this.p=new f(b.p,16),this.red=b.prime?f.red(b.prime):f.mont(this.p),this.zero=new f(0).toRed(this.red),this.one=new f(1).toRed(this.red),this.two=new f(2).toRed(this.red),this.n=b.n&&new f(b.n,16),this.g=b.g&&this.pointFromJSON(b.g,b.gRed),this._wnafT1=new Array(4),this._wnafT2=new Array(4),this._wnafT3=new Array(4),this._wnafT4=new Array(4);var c=this.n&&this.p.div(this.n);!c||c.cmpn(100)>0?this.redN=null:(this._maxwellTrick=!0,this.redN=this.n.toRed(this.red))}function e(a,b){this.curve=a,this.type=b,this.precomputed=null}var f=a("bn.js"),g=a("../../elliptic"),h=g.utils,i=h.getNAF,j=h.getJSF,k=h.assert;b.exports=d,d.prototype.point=function(){throw new Error("Not implemented")},d.prototype.validate=function(){throw new Error("Not implemented")},d.prototype._fixedNafMul=function(a,b){k(a.precomputed);var c=a._getDoubles(),d=i(b,1),e=(1<<c.step+1)-(c.step%2===0?2:1);e/=3;for(var f=[],g=0;g<d.length;g+=c.step){for(var h=0,b=g+c.step-1;b>=g;b--)h=(h<<1)+d[b];f.push(h)}for(var j=this.jpoint(null,null,null),l=this.jpoint(null,null,null),m=e;m>0;m--){for(var g=0;g<f.length;g++){var h=f[g];h===m?l=l.mixedAdd(c.points[g]):h===-m&&(l=l.mixedAdd(c.points[g].neg()))}j=j.add(l)}return j.toP()},d.prototype._wnafMul=function(a,b){var c=4,d=a._getNAFPoints(c);c=d.wnd;for(var e=d.points,f=i(b,c),g=this.jpoint(null,null,null),h=f.length-1;h>=0;h--){for(var b=0;h>=0&&0===f[h];h--)b++;if(h>=0&&b++,g=g.dblp(b),h<0)break;var j=f[h];k(0!==j),g="affine"===a.type?j>0?g.mixedAdd(e[j-1>>1]):g.mixedAdd(e[-j-1>>1].neg()):j>0?g.add(e[j-1>>1]):g.add(e[-j-1>>1].neg())}return"affine"===a.type?g.toP():g},d.prototype._wnafMulAdd=function(a,b,c,d,e){for(var f=this._wnafT1,g=this._wnafT2,h=this._wnafT3,k=0,l=0;l<d;l++){var m=b[l],n=m._getNAFPoints(a);f[l]=n.wnd,g[l]=n.points}for(var l=d-1;l>=1;l-=2){var o=l-1,p=l;if(1===f[o]&&1===f[p]){var q=[b[o],null,null,b[p]];0===b[o].y.cmp(b[p].y)?(q[1]=b[o].add(b[p]),q[2]=b[o].toJ().mixedAdd(b[p].neg())):0===b[o].y.cmp(b[p].y.redNeg())?(q[1]=b[o].toJ().mixedAdd(b[p]),q[2]=b[o].add(b[p].neg())):(q[1]=b[o].toJ().mixedAdd(b[p]),q[2]=b[o].toJ().mixedAdd(b[p].neg()));var r=[-3,-1,-5,-7,0,7,5,1,3],s=j(c[o],c[p]);k=Math.max(s[0].length,k),h[o]=new Array(k),h[p]=new Array(k);for(var t=0;t<k;t++){var u=0|s[0][t],v=0|s[1][t];h[o][t]=r[3*(u+1)+(v+1)],h[p][t]=0,g[o]=q}}else h[o]=i(c[o],f[o]),h[p]=i(c[p],f[p]),k=Math.max(h[o].length,k),k=Math.max(h[p].length,k)}for(var w=this.jpoint(null,null,null),x=this._wnafT4,l=k;l>=0;l--){for(var y=0;l>=0;){for(var z=!0,t=0;t<d;t++)x[t]=0|h[t][l],0!==x[t]&&(z=!1);if(!z)break;y++,l--}if(l>=0&&y++,w=w.dblp(y),l<0)break;for(var t=0;t<d;t++){var m,A=x[t];0!==A&&(A>0?m=g[t][A-1>>1]:A<0&&(m=g[t][-A-1>>1].neg()),w="affine"===m.type?w.mixedAdd(m):w.add(m))}}for(var l=0;l<d;l++)g[l]=null;return e?w:w.toP()},d.BasePoint=e,e.prototype.eq=function(){throw new Error("Not implemented")},e.prototype.validate=function(){return this.curve.validate(this)},d.prototype.decodePoint=function(a,b){a=h.toArray(a,b);var c=this.p.byteLength();if((4===a[0]||6===a[0]||7===a[0])&&a.length-1===2*c){6===a[0]?k(a[a.length-1]%2===0):7===a[0]&&k(a[a.length-1]%2===1);var d=this.point(a.slice(1,1+c),a.slice(1+c,1+2*c));return d}if((2===a[0]||3===a[0])&&a.length-1===c)return this.pointFromX(a.slice(1,1+c),3===a[0]);throw new Error("Unknown point format")},e.prototype.encodeCompressed=function(a){return this.encode(a,!0)},e.prototype._encode=function(a){var b=this.curve.p.byteLength(),c=this.getX().toArray("be",b);return a?[this.getY().isEven()?2:3].concat(c):[4].concat(c,this.getY().toArray("be",b))},e.prototype.encode=function(a,b){return h.encode(this._encode(b),a)},e.prototype.precompute=function(a){if(this.precomputed)return this;var b={doubles:null,naf:null,beta:null};return b.naf=this._getNAFPoints(8),b.doubles=this._getDoubles(4,a),b.beta=this._getBeta(),this.precomputed=b,this},e.prototype._hasDoubles=function(a){if(!this.precomputed)return!1;var b=this.precomputed.doubles;return!!b&&b.points.length>=Math.ceil((a.bitLength()+1)/b.step)},e.prototype._getDoubles=function(a,b){if(this.precomputed&&this.precomputed.doubles)return this.precomputed.doubles;for(var c=[this],d=this,e=0;e<b;e+=a){for(var f=0;f<a;f++)d=d.dbl();c.push(d)}return{step:a,points:c}},e.prototype._getNAFPoints=function(a){if(this.precomputed&&this.precomputed.naf)return this.precomputed.naf;for(var b=[this],c=(1<<a)-1,d=1===c?null:this.dbl(),e=1;e<c;e++)b[e]=b[e-1].add(d);return{wnd:a,points:b}},e.prototype._getBeta=function(){return null},e.prototype.dblp=function(a){for(var b=this,c=0;c<a;c++)b=b.dbl();return b}},{"../../elliptic":1,"bn.js":16}],3:[function(a,b,c){"use strict";function d(a){this.twisted=1!==(0|a.a),this.mOneA=this.twisted&&(0|a.a)===-1,this.extended=this.mOneA,j.call(this,"edwards",a),this.a=new h(a.a,16).umod(this.red.m),this.a=this.a.toRed(this.red),this.c=new h(a.c,16).toRed(this.red),this.c2=this.c.redSqr(),this.d=new h(a.d,16).toRed(this.red),this.dd=this.d.redAdd(this.d),k(!this.twisted||0===this.c.fromRed().cmpn(1)),this.oneC=1===(0|a.c)}function e(a,b,c,d,e){j.BasePoint.call(this,a,"projective"),null===b&&null===c&&null===d?(this.x=this.curve.zero,this.y=this.curve.one,this.z=this.curve.one,this.t=this.curve.zero,this.zOne=!0):(this.x=new h(b,16),this.y=new h(c,16),this.z=d?new h(d,16):this.curve.one,this.t=e&&new h(e,16),this.x.red||(this.x=this.x.toRed(this.curve.red)),this.y.red||(this.y=this.y.toRed(this.curve.red)),this.z.red||(this.z=this.z.toRed(this.curve.red)),this.t&&!this.t.red&&(this.t=this.t.toRed(this.curve.red)),this.zOne=this.z===this.curve.one,this.curve.extended&&!this.t&&(this.t=this.x.redMul(this.y),this.zOne||(this.t=this.t.redMul(this.z.redInvm()))))}var f=a("../curve"),g=a("../../elliptic"),h=a("bn.js"),i=a("inherits"),j=f.base,k=g.utils.assert;i(d,j),b.exports=d,d.prototype._mulA=function(a){return this.mOneA?a.redNeg():this.a.redMul(a)},d.prototype._mulC=function(a){return this.oneC?a:this.c.redMul(a)},d.prototype.jpoint=function(a,b,c,d){return this.point(a,b,c,d)},d.prototype.pointFromX=function(a,b){a=new h(a,16),a.red||(a=a.toRed(this.red));var c=a.redSqr(),d=this.c2.redSub(this.a.redMul(c)),e=this.one.redSub(this.c2.redMul(this.d).redMul(c)),f=d.redMul(e.redInvm()),g=f.redSqrt();if(0!==g.redSqr().redSub(f).cmp(this.zero))throw new Error("invalid point");var i=g.fromRed().isOdd();return(b&&!i||!b&&i)&&(g=g.redNeg()),this.point(a,g)},d.prototype.pointFromY=function(a,b){a=new h(a,16),a.red||(a=a.toRed(this.red));var c=a.redSqr(),d=c.redSub(this.one),e=c.redMul(this.d).redAdd(this.one),f=d.redMul(e.redInvm());if(0===f.cmp(this.zero)){if(b)throw new Error("invalid point");return this.point(this.zero,a)}var g=f.redSqrt();if(0!==g.redSqr().redSub(f).cmp(this.zero))throw new Error("invalid point");return g.isOdd()!==b&&(g=g.redNeg()),this.point(g,a)},d.prototype.validate=function(a){if(a.isInfinity())return!0;a.normalize();var b=a.x.redSqr(),c=a.y.redSqr(),d=b.redMul(this.a).redAdd(c),e=this.c2.redMul(this.one.redAdd(this.d.redMul(b).redMul(c)));return 0===d.cmp(e)},i(e,j.BasePoint),d.prototype.pointFromJSON=function(a){return e.fromJSON(this,a)},d.prototype.point=function(a,b,c,d){return new e(this,a,b,c,d)},e.fromJSON=function(a,b){return new e(a,b[0],b[1],b[2])},e.prototype.inspect=function(){return this.isInfinity()?"<EC Point Infinity>":"<EC Point x: "+this.x.fromRed().toString(16,2)+" y: "+this.y.fromRed().toString(16,2)+" z: "+this.z.fromRed().toString(16,2)+">"},e.prototype.isInfinity=function(){return 0===this.x.cmpn(0)&&0===this.y.cmp(this.z)},e.prototype._extDbl=function(){var a=this.x.redSqr(),b=this.y.redSqr(),c=this.z.redSqr();c=c.redIAdd(c);var d=this.curve._mulA(a),e=this.x.redAdd(this.y).redSqr().redISub(a).redISub(b),f=d.redAdd(b),g=f.redSub(c),h=d.redSub(b),i=e.redMul(g),j=f.redMul(h),k=e.redMul(h),l=g.redMul(f);return this.curve.point(i,j,l,k)},e.prototype._projDbl=function(){var a,b,c,d=this.x.redAdd(this.y).redSqr(),e=this.x.redSqr(),f=this.y.redSqr();if(this.curve.twisted){var g=this.curve._mulA(e),h=g.redAdd(f);if(this.zOne)a=d.redSub(e).redSub(f).redMul(h.redSub(this.curve.two)),b=h.redMul(g.redSub(f)),c=h.redSqr().redSub(h).redSub(h);else{var i=this.z.redSqr(),j=h.redSub(i).redISub(i);a=d.redSub(e).redISub(f).redMul(j),b=h.redMul(g.redSub(f)),c=h.redMul(j)}}else{var g=e.redAdd(f),i=this.curve._mulC(this.c.redMul(this.z)).redSqr(),j=g.redSub(i).redSub(i);a=this.curve._mulC(d.redISub(g)).redMul(j),b=this.curve._mulC(g).redMul(e.redISub(f)),c=g.redMul(j)}return this.curve.point(a,b,c)},e.prototype.dbl=function(){return this.isInfinity()?this:this.curve.extended?this._extDbl():this._projDbl()},e.prototype._extAdd=function(a){var b=this.y.redSub(this.x).redMul(a.y.redSub(a.x)),c=this.y.redAdd(this.x).redMul(a.y.redAdd(a.x)),d=this.t.redMul(this.curve.dd).redMul(a.t),e=this.z.redMul(a.z.redAdd(a.z)),f=c.redSub(b),g=e.redSub(d),h=e.redAdd(d),i=c.redAdd(b),j=f.redMul(g),k=h.redMul(i),l=f.redMul(i),m=g.redMul(h);return this.curve.point(j,k,m,l)},e.prototype._projAdd=function(a){var b,c,d=this.z.redMul(a.z),e=d.redSqr(),f=this.x.redMul(a.x),g=this.y.redMul(a.y),h=this.curve.d.redMul(f).redMul(g),i=e.redSub(h),j=e.redAdd(h),k=this.x.redAdd(this.y).redMul(a.x.redAdd(a.y)).redISub(f).redISub(g),l=d.redMul(i).redMul(k);return this.curve.twisted?(b=d.redMul(j).redMul(g.redSub(this.curve._mulA(f))),c=i.redMul(j)):(b=d.redMul(j).redMul(g.redSub(f)),c=this.curve._mulC(i).redMul(j)),this.curve.point(l,b,c)},e.prototype.add=function(a){return this.isInfinity()?a:a.isInfinity()?this:this.curve.extended?this._extAdd(a):this._projAdd(a)},e.prototype.mul=function(a){return this._hasDoubles(a)?this.curve._fixedNafMul(this,a):this.curve._wnafMul(this,a)},e.prototype.mulAdd=function(a,b,c){return this.curve._wnafMulAdd(1,[this,b],[a,c],2,!1)},e.prototype.jmulAdd=function(a,b,c){return this.curve._wnafMulAdd(1,[this,b],[a,c],2,!0)},e.prototype.normalize=function(){if(this.zOne)return this;var a=this.z.redInvm();return this.x=this.x.redMul(a),this.y=this.y.redMul(a),this.t&&(this.t=this.t.redMul(a)),this.z=this.curve.one,this.zOne=!0,this},e.prototype.neg=function(){return this.curve.point(this.x.redNeg(),this.y,this.z,this.t&&this.t.redNeg())},e.prototype.getX=function(){return this.normalize(),this.x.fromRed()},e.prototype.getY=function(){return this.normalize(),this.y.fromRed()},e.prototype.eq=function(a){return this===a||0===this.getX().cmp(a.getX())&&0===this.getY().cmp(a.getY())},e.prototype.eqXToP=function(a){var b=a.toRed(this.curve.red).redMul(this.z);if(0===this.x.cmp(b))return!0;for(var c=a.clone(),d=this.curve.redN.redMul(this.z);;){if(c.iadd(this.curve.n),c.cmp(this.curve.p)>=0)return!1;if(b.redIAdd(d),0===this.x.cmp(b))return!0}return!1},e.prototype.toP=e.prototype.normalize,e.prototype.mixedAdd=e.prototype.add},{"../../elliptic":1,"../curve":4,"bn.js":16,inherits:27}],4:[function(a,b,c){"use strict";var d=c;d.base=a("./base"),d["short"]=a("./short"),d.mont=a("./mont"),d.edwards=a("./edwards")},{"./base":2,"./edwards":3,"./mont":5,"./short":6}],5:[function(a,b,c){"use strict";function d(a){i.call(this,"mont",a),this.a=new g(a.a,16).toRed(this.red),this.b=new g(a.b,16).toRed(this.red),this.i4=new g(4).toRed(this.red).redInvm(),this.two=new g(2).toRed(this.red),this.a24=this.i4.redMul(this.a.redAdd(this.two))}function e(a,b,c){i.BasePoint.call(this,a,"projective"),null===b&&null===c?(this.x=this.curve.one,this.z=this.curve.zero):(this.x=new g(b,16),this.z=new g(c,16),this.x.red||(this.x=this.x.toRed(this.curve.red)),this.z.red||(this.z=this.z.toRed(this.curve.red)))}var f=a("../curve"),g=a("bn.js"),h=a("inherits"),i=f.base,j=a("../../elliptic"),k=j.utils;h(d,i),b.exports=d,d.prototype.validate=function(a){var b=a.normalize().x,c=b.redSqr(),d=c.redMul(b).redAdd(c.redMul(this.a)).redAdd(b),e=d.redSqrt();return 0===e.redSqr().cmp(d)},h(e,i.BasePoint),d.prototype.decodePoint=function(a,b){return this.point(k.toArray(a,b),1)},d.prototype.point=function(a,b){return new e(this,a,b)},d.prototype.pointFromJSON=function(a){return e.fromJSON(this,a)},e.prototype.precompute=function(){},e.prototype._encode=function(){return this.getX().toArray("be",this.curve.p.byteLength())},e.fromJSON=function(a,b){return new e(a,b[0],b[1]||a.one)},e.prototype.inspect=function(){return this.isInfinity()?"<EC Point Infinity>":"<EC Point x: "+this.x.fromRed().toString(16,2)+" z: "+this.z.fromRed().toString(16,2)+">"},e.prototype.isInfinity=function(){return 0===this.z.cmpn(0)},e.prototype.dbl=function(){var a=this.x.redAdd(this.z),b=a.redSqr(),c=this.x.redSub(this.z),d=c.redSqr(),e=b.redSub(d),f=b.redMul(d),g=e.redMul(d.redAdd(this.curve.a24.redMul(e)));return this.curve.point(f,g)},e.prototype.add=function(){throw new Error("Not supported on Montgomery curve")},e.prototype.diffAdd=function(a,b){var c=this.x.redAdd(this.z),d=this.x.redSub(this.z),e=a.x.redAdd(a.z),f=a.x.redSub(a.z),g=f.redMul(c),h=e.redMul(d),i=b.z.redMul(g.redAdd(h).redSqr()),j=b.x.redMul(g.redISub(h).redSqr());return this.curve.point(i,j)},e.prototype.mul=function(a){for(var b=a.clone(),c=this,d=this.curve.point(null,null),e=this,f=[];0!==b.cmpn(0);b.iushrn(1))f.push(b.andln(1));for(var g=f.length-1;g>=0;g--)0===f[g]?(c=c.diffAdd(d,e),d=d.dbl()):(d=c.diffAdd(d,e),c=c.dbl());return d},e.prototype.mulAdd=function(){throw new Error("Not supported on Montgomery curve")},e.prototype.jumlAdd=function(){throw new Error("Not supported on Montgomery curve")},e.prototype.eq=function(a){return 0===this.getX().cmp(a.getX())},e.prototype.normalize=function(){return this.x=this.x.redMul(this.z.redInvm()),this.z=this.curve.one,this},e.prototype.getX=function(){return this.normalize(),this.x.fromRed()}},{"../../elliptic":1,"../curve":4,"bn.js":16,inherits:27}],6:[function(a,b,c){"use strict";function d(a){k.call(this,"short",a),this.a=new i(a.a,16).toRed(this.red),this.b=new i(a.b,16).toRed(this.red),this.tinv=this.two.redInvm(),this.zeroA=0===this.a.fromRed().cmpn(0),this.threeA=0===this.a.fromRed().sub(this.p).cmpn(-3),this.endo=this._getEndomorphism(a),this._endoWnafT1=new Array(4),this._endoWnafT2=new Array(4)}function e(a,b,c,d){k.BasePoint.call(this,a,"affine"),null===b&&null===c?(this.x=null,this.y=null,this.inf=!0):(this.x=new i(b,16),this.y=new i(c,16),d&&(this.x.forceRed(this.curve.red),this.y.forceRed(this.curve.red)),this.x.red||(this.x=this.x.toRed(this.curve.red)),this.y.red||(this.y=this.y.toRed(this.curve.red)),this.inf=!1)}function f(a,b,c,d){k.BasePoint.call(this,a,"jacobian"),null===b&&null===c&&null===d?(this.x=this.curve.one,this.y=this.curve.one,this.z=new i(0)):(this.x=new i(b,16),this.y=new i(c,16),this.z=new i(d,16)),this.x.red||(this.x=this.x.toRed(this.curve.red)),this.y.red||(this.y=this.y.toRed(this.curve.red)),this.z.red||(this.z=this.z.toRed(this.curve.red)),this.zOne=this.z===this.curve.one}var g=a("../curve"),h=a("../../elliptic"),i=a("bn.js"),j=a("inherits"),k=g.base,l=h.utils.assert;j(d,k),b.exports=d,d.prototype._getEndomorphism=function(a){if(this.zeroA&&this.g&&this.n&&1===this.p.modn(3)){var b,c;if(a.beta)b=new i(a.beta,16).toRed(this.red);else{var d=this._getEndoRoots(this.p);b=d[0].cmp(d[1])<0?d[0]:d[1],b=b.toRed(this.red)}if(a.lambda)c=new i(a.lambda,16);else{var e=this._getEndoRoots(this.n);0===this.g.mul(e[0]).x.cmp(this.g.x.redMul(b))?c=e[0]:(c=e[1],l(0===this.g.mul(c).x.cmp(this.g.x.redMul(b))))}var f;return f=a.basis?a.basis.map(function(a){return{a:new i(a.a,16),b:new i(a.b,16)}}):this._getEndoBasis(c),{beta:b,lambda:c,basis:f}}},d.prototype._getEndoRoots=function(a){var b=a===this.p?this.red:i.mont(a),c=new i(2).toRed(b).redInvm(),d=c.redNeg(),e=new i(3).toRed(b).redNeg().redSqrt().redMul(c),f=d.redAdd(e).fromRed(),g=d.redSub(e).fromRed();return[f,g]},d.prototype._getEndoBasis=function(a){for(var b,c,d,e,f,g,h,j,k,l=this.n.ushrn(Math.floor(this.n.bitLength()/2)),m=a,n=this.n.clone(),o=new i(1),p=new i(0),q=new i(0),r=new i(1),s=0;0!==m.cmpn(0);){var t=n.div(m);j=n.sub(t.mul(m)),k=q.sub(t.mul(o));var u=r.sub(t.mul(p));if(!d&&j.cmp(l)<0)b=h.neg(),c=o,d=j.neg(),e=k;else if(d&&2===++s)break;h=j,n=m,m=j,q=o,o=k,r=p,p=u}f=j.neg(),g=k;var v=d.sqr().add(e.sqr()),w=f.sqr().add(g.sqr());return w.cmp(v)>=0&&(f=b,g=c),d.negative&&(d=d.neg(),e=e.neg()),f.negative&&(f=f.neg(),g=g.neg()),[{a:d,b:e},{a:f,b:g}]},d.prototype._endoSplit=function(a){var b=this.endo.basis,c=b[0],d=b[1],e=d.b.mul(a).divRound(this.n),f=c.b.neg().mul(a).divRound(this.n),g=e.mul(c.a),h=f.mul(d.a),i=e.mul(c.b),j=f.mul(d.b),k=a.sub(g).sub(h),l=i.add(j).neg();return{k1:k,k2:l}},d.prototype.pointFromX=function(a,b){a=new i(a,16),a.red||(a=a.toRed(this.red));var c=a.redSqr().redMul(a).redIAdd(a.redMul(this.a)).redIAdd(this.b),d=c.redSqrt();if(0!==d.redSqr().redSub(c).cmp(this.zero))throw new Error("invalid point");var e=d.fromRed().isOdd();return(b&&!e||!b&&e)&&(d=d.redNeg()),this.point(a,d)},d.prototype.validate=function(a){if(a.inf)return!0;var b=a.x,c=a.y,d=this.a.redMul(b),e=b.redSqr().redMul(b).redIAdd(d).redIAdd(this.b);return 0===c.redSqr().redISub(e).cmpn(0)},d.prototype._endoWnafMulAdd=function(a,b,c){for(var d=this._endoWnafT1,e=this._endoWnafT2,f=0;f<a.length;f++){var g=this._endoSplit(b[f]),h=a[f],i=h._getBeta();g.k1.negative&&(g.k1.ineg(),h=h.neg(!0)),g.k2.negative&&(g.k2.ineg(),i=i.neg(!0)),d[2*f]=h,d[2*f+1]=i,e[2*f]=g.k1,e[2*f+1]=g.k2}for(var j=this._wnafMulAdd(1,d,e,2*f,c),k=0;k<2*f;k++)d[k]=null,e[k]=null;return j},j(e,k.BasePoint),d.prototype.point=function(a,b,c){return new e(this,a,b,c)},d.prototype.pointFromJSON=function(a,b){return e.fromJSON(this,a,b)},e.prototype._getBeta=function(){if(this.curve.endo){var a=this.precomputed;if(a&&a.beta)return a.beta;var b=this.curve.point(this.x.redMul(this.curve.endo.beta),this.y);if(a){var c=this.curve,d=function(a){return c.point(a.x.redMul(c.endo.beta),a.y)};a.beta=b,b.precomputed={beta:null,naf:a.naf&&{wnd:a.naf.wnd,points:a.naf.points.map(d)},doubles:a.doubles&&{step:a.doubles.step,points:a.doubles.points.map(d)}}}return b}},e.prototype.toJSON=function(){return this.precomputed?[this.x,this.y,this.precomputed&&{doubles:this.precomputed.doubles&&{step:this.precomputed.doubles.step,points:this.precomputed.doubles.points.slice(1)},naf:this.precomputed.naf&&{wnd:this.precomputed.naf.wnd,points:this.precomputed.naf.points.slice(1)}}]:[this.x,this.y]},e.fromJSON=function(a,b,c){function d(b){return a.point(b[0],b[1],c)}"string"==typeof b&&(b=JSON.parse(b));var e=a.point(b[0],b[1],c);if(!b[2])return e;var f=b[2];return e.precomputed={beta:null,doubles:f.doubles&&{step:f.doubles.step,points:[e].concat(f.doubles.points.map(d))},naf:f.naf&&{wnd:f.naf.wnd,points:[e].concat(f.naf.points.map(d))}},e},e.prototype.inspect=function(){return this.isInfinity()?"<EC Point Infinity>":"<EC Point x: "+this.x.fromRed().toString(16,2)+" y: "+this.y.fromRed().toString(16,2)+">"},e.prototype.isInfinity=function(){return this.inf},e.prototype.add=function(a){if(this.inf)return a;if(a.inf)return this;if(this.eq(a))return this.dbl();if(this.neg().eq(a))return this.curve.point(null,null);if(0===this.x.cmp(a.x))return this.curve.point(null,null);var b=this.y.redSub(a.y);0!==b.cmpn(0)&&(b=b.redMul(this.x.redSub(a.x).redInvm()));var c=b.redSqr().redISub(this.x).redISub(a.x),d=b.redMul(this.x.redSub(c)).redISub(this.y);return this.curve.point(c,d)},e.prototype.dbl=function(){if(this.inf)return this;var a=this.y.redAdd(this.y);if(0===a.cmpn(0))return this.curve.point(null,null);var b=this.curve.a,c=this.x.redSqr(),d=a.redInvm(),e=c.redAdd(c).redIAdd(c).redIAdd(b).redMul(d),f=e.redSqr().redISub(this.x.redAdd(this.x)),g=e.redMul(this.x.redSub(f)).redISub(this.y);return this.curve.point(f,g)},e.prototype.getX=function(){return this.x.fromRed()},e.prototype.getY=function(){return this.y.fromRed()},e.prototype.mul=function(a){return a=new i(a,16),this._hasDoubles(a)?this.curve._fixedNafMul(this,a):this.curve.endo?this.curve._endoWnafMulAdd([this],[a]):this.curve._wnafMul(this,a)},e.prototype.mulAdd=function(a,b,c){var d=[this,b],e=[a,c];return this.curve.endo?this.curve._endoWnafMulAdd(d,e):this.curve._wnafMulAdd(1,d,e,2)},e.prototype.jmulAdd=function(a,b,c){var d=[this,b],e=[a,c];return this.curve.endo?this.curve._endoWnafMulAdd(d,e,!0):this.curve._wnafMulAdd(1,d,e,2,!0)},e.prototype.eq=function(a){return this===a||this.inf===a.inf&&(this.inf||0===this.x.cmp(a.x)&&0===this.y.cmp(a.y))},e.prototype.neg=function(a){if(this.inf)return this;var b=this.curve.point(this.x,this.y.redNeg());if(a&&this.precomputed){var c=this.precomputed,d=function(a){return a.neg()};b.precomputed={naf:c.naf&&{wnd:c.naf.wnd,points:c.naf.points.map(d)},doubles:c.doubles&&{step:c.doubles.step,points:c.doubles.points.map(d)}}}return b},e.prototype.toJ=function(){if(this.inf)return this.curve.jpoint(null,null,null);var a=this.curve.jpoint(this.x,this.y,this.curve.one);return a},j(f,k.BasePoint),d.prototype.jpoint=function(a,b,c){return new f(this,a,b,c)},f.prototype.toP=function(){if(this.isInfinity())return this.curve.point(null,null);var a=this.z.redInvm(),b=a.redSqr(),c=this.x.redMul(b),d=this.y.redMul(b).redMul(a);return this.curve.point(c,d)},f.prototype.neg=function(){return this.curve.jpoint(this.x,this.y.redNeg(),this.z)},f.prototype.add=function(a){if(this.isInfinity())return a;if(a.isInfinity())return this;var b=a.z.redSqr(),c=this.z.redSqr(),d=this.x.redMul(b),e=a.x.redMul(c),f=this.y.redMul(b.redMul(a.z)),g=a.y.redMul(c.redMul(this.z)),h=d.redSub(e),i=f.redSub(g);if(0===h.cmpn(0))return 0!==i.cmpn(0)?this.curve.jpoint(null,null,null):this.dbl();var j=h.redSqr(),k=j.redMul(h),l=d.redMul(j),m=i.redSqr().redIAdd(k).redISub(l).redISub(l),n=i.redMul(l.redISub(m)).redISub(f.redMul(k)),o=this.z.redMul(a.z).redMul(h);return this.curve.jpoint(m,n,o)},f.prototype.mixedAdd=function(a){if(this.isInfinity())return a.toJ();if(a.isInfinity())return this;var b=this.z.redSqr(),c=this.x,d=a.x.redMul(b),e=this.y,f=a.y.redMul(b).redMul(this.z),g=c.redSub(d),h=e.redSub(f);if(0===g.cmpn(0))return 0!==h.cmpn(0)?this.curve.jpoint(null,null,null):this.dbl();var i=g.redSqr(),j=i.redMul(g),k=c.redMul(i),l=h.redSqr().redIAdd(j).redISub(k).redISub(k),m=h.redMul(k.redISub(l)).redISub(e.redMul(j)),n=this.z.redMul(g);return this.curve.jpoint(l,m,n)},f.prototype.dblp=function(a){if(0===a)return this;if(this.isInfinity())return this;if(!a)return this.dbl();if(this.curve.zeroA||this.curve.threeA){for(var b=this,c=0;c<a;c++)b=b.dbl();return b}for(var d=this.curve.a,e=this.curve.tinv,f=this.x,g=this.y,h=this.z,i=h.redSqr().redSqr(),j=g.redAdd(g),c=0;c<a;c++){var k=f.redSqr(),l=j.redSqr(),m=l.redSqr(),n=k.redAdd(k).redIAdd(k).redIAdd(d.redMul(i)),o=f.redMul(l),p=n.redSqr().redISub(o.redAdd(o)),q=o.redISub(p),r=n.redMul(q);r=r.redIAdd(r).redISub(m);var s=j.redMul(h);c+1<a&&(i=i.redMul(m)),f=p,h=s,j=r}return this.curve.jpoint(f,j.redMul(e),h)},f.prototype.dbl=function(){return this.isInfinity()?this:this.curve.zeroA?this._zeroDbl():this.curve.threeA?this._threeDbl():this._dbl()},f.prototype._zeroDbl=function(){var a,b,c;if(this.zOne){var d=this.x.redSqr(),e=this.y.redSqr(),f=e.redSqr(),g=this.x.redAdd(e).redSqr().redISub(d).redISub(f);g=g.redIAdd(g);var h=d.redAdd(d).redIAdd(d),i=h.redSqr().redISub(g).redISub(g),j=f.redIAdd(f);j=j.redIAdd(j),j=j.redIAdd(j),a=i,b=h.redMul(g.redISub(i)).redISub(j),c=this.y.redAdd(this.y)}else{var k=this.x.redSqr(),l=this.y.redSqr(),m=l.redSqr(),n=this.x.redAdd(l).redSqr().redISub(k).redISub(m);n=n.redIAdd(n);var o=k.redAdd(k).redIAdd(k),p=o.redSqr(),q=m.redIAdd(m);q=q.redIAdd(q),q=q.redIAdd(q),a=p.redISub(n).redISub(n),b=o.redMul(n.redISub(a)).redISub(q),c=this.y.redMul(this.z),c=c.redIAdd(c)}return this.curve.jpoint(a,b,c)},f.prototype._threeDbl=function(){var a,b,c;if(this.zOne){var d=this.x.redSqr(),e=this.y.redSqr(),f=e.redSqr(),g=this.x.redAdd(e).redSqr().redISub(d).redISub(f);g=g.redIAdd(g);var h=d.redAdd(d).redIAdd(d).redIAdd(this.curve.a),i=h.redSqr().redISub(g).redISub(g);a=i;var j=f.redIAdd(f);j=j.redIAdd(j),j=j.redIAdd(j),b=h.redMul(g.redISub(i)).redISub(j),c=this.y.redAdd(this.y)}else{var k=this.z.redSqr(),l=this.y.redSqr(),m=this.x.redMul(l),n=this.x.redSub(k).redMul(this.x.redAdd(k));n=n.redAdd(n).redIAdd(n);var o=m.redIAdd(m);o=o.redIAdd(o);var p=o.redAdd(o);a=n.redSqr().redISub(p),c=this.y.redAdd(this.z).redSqr().redISub(l).redISub(k);var q=l.redSqr();q=q.redIAdd(q),q=q.redIAdd(q),q=q.redIAdd(q),b=n.redMul(o.redISub(a)).redISub(q)}return this.curve.jpoint(a,b,c)},f.prototype._dbl=function(){var a=this.curve.a,b=this.x,c=this.y,d=this.z,e=d.redSqr().redSqr(),f=b.redSqr(),g=c.redSqr(),h=f.redAdd(f).redIAdd(f).redIAdd(a.redMul(e)),i=b.redAdd(b);i=i.redIAdd(i);var j=i.redMul(g),k=h.redSqr().redISub(j.redAdd(j)),l=j.redISub(k),m=g.redSqr();m=m.redIAdd(m),m=m.redIAdd(m),m=m.redIAdd(m);var n=h.redMul(l).redISub(m),o=c.redAdd(c).redMul(d);return this.curve.jpoint(k,n,o)},f.prototype.trpl=function(){if(!this.curve.zeroA)return this.dbl().add(this);var a=this.x.redSqr(),b=this.y.redSqr(),c=this.z.redSqr(),d=b.redSqr(),e=a.redAdd(a).redIAdd(a),f=e.redSqr(),g=this.x.redAdd(b).redSqr().redISub(a).redISub(d);g=g.redIAdd(g),g=g.redAdd(g).redIAdd(g),g=g.redISub(f);var h=g.redSqr(),i=d.redIAdd(d);i=i.redIAdd(i),i=i.redIAdd(i),i=i.redIAdd(i);var j=e.redIAdd(g).redSqr().redISub(f).redISub(h).redISub(i),k=b.redMul(j);k=k.redIAdd(k),k=k.redIAdd(k);var l=this.x.redMul(h).redISub(k);l=l.redIAdd(l),l=l.redIAdd(l);var m=this.y.redMul(j.redMul(i.redISub(j)).redISub(g.redMul(h)));m=m.redIAdd(m),m=m.redIAdd(m),m=m.redIAdd(m);var n=this.z.redAdd(g).redSqr().redISub(c).redISub(h);return this.curve.jpoint(l,m,n)},f.prototype.mul=function(a,b){return a=new i(a,b),this.curve._wnafMul(this,a)},f.prototype.eq=function(a){if("affine"===a.type)return this.eq(a.toJ());if(this===a)return!0;var b=this.z.redSqr(),c=a.z.redSqr();if(0!==this.x.redMul(c).redISub(a.x.redMul(b)).cmpn(0))return!1;var d=b.redMul(this.z),e=c.redMul(a.z);return 0===this.y.redMul(e).redISub(a.y.redMul(d)).cmpn(0)},f.prototype.eqXToP=function(a){var b=this.z.redSqr(),c=a.toRed(this.curve.red).redMul(b);if(0===this.x.cmp(c))return!0;for(var d=a.clone(),e=this.curve.redN.redMul(b);;){if(d.iadd(this.curve.n),d.cmp(this.curve.p)>=0)return!1;if(c.redIAdd(e),0===this.x.cmp(c))return!0}return!1},f.prototype.inspect=function(){return this.isInfinity()?"<EC JPoint Infinity>":"<EC JPoint x: "+this.x.toString(16,2)+" y: "+this.y.toString(16,2)+" z: "+this.z.toString(16,2)+">"},f.prototype.isInfinity=function(){return 0===this.z.cmpn(0)}},{"../../elliptic":1,"../curve":4,"bn.js":16,inherits:27}],7:[function(a,b,c){"use strict";function d(a){"short"===a.type?this.curve=new h.curve["short"](a):"edwards"===a.type?this.curve=new h.curve.edwards(a):this.curve=new h.curve.mont(a),this.g=this.curve.g,this.n=this.curve.n,this.hash=a.hash,i(this.g.validate(),"Invalid curve"),i(this.g.mul(this.n).isInfinity(),"Invalid curve, G*N != O")}function e(a,b){Object.defineProperty(f,a,{configurable:!0,enumerable:!0,get:function(){var c=new d(b);return Object.defineProperty(f,a,{configurable:!0,enumerable:!0,value:c}),c}})}var f=c,g=a("hash.js"),h=a("../elliptic"),i=h.utils.assert;f.PresetCurve=d,e("p192",{type:"short",prime:"p192",p:"ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff",a:"ffffffff ffffffff ffffffff fffffffe ffffffff fffffffc",b:"64210519 e59c80e7 0fa7e9ab 72243049 feb8deec c146b9b1",n:"ffffffff ffffffff ffffffff 99def836 146bc9b1 b4d22831",hash:g.sha256,gRed:!1,g:["188da80e b03090f6 7cbf20eb 43a18800 f4ff0afd 82ff1012","07192b95 ffc8da78 631011ed 6b24cdd5 73f977a1 1e794811"]}),e("p224",{type:"short",prime:"p224",p:"ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001",a:"ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff fffffffe",b:"b4050a85 0c04b3ab f5413256 5044b0b7 d7bfd8ba 270b3943 2355ffb4",n:"ffffffff ffffffff ffffffff ffff16a2 e0b8f03e 13dd2945 5c5c2a3d",hash:g.sha256,gRed:!1,g:["b70e0cbd 6bb4bf7f 321390b9 4a03c1d3 56c21122 343280d6 115c1d21","bd376388 b5f723fb 4c22dfe6 cd4375a0 5a074764 44d58199 85007e34"]}),e("p256",{type:"short",prime:null,p:"ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff ffffffff",a:"ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff fffffffc",b:"5ac635d8 aa3a93e7 b3ebbd55 769886bc 651d06b0 cc53b0f6 3bce3c3e 27d2604b",n:"ffffffff 00000000 ffffffff ffffffff bce6faad a7179e84 f3b9cac2 fc632551",hash:g.sha256,gRed:!1,g:["6b17d1f2 e12c4247 f8bce6e5 63a440f2 77037d81 2deb33a0 f4a13945 d898c296","4fe342e2 fe1a7f9b 8ee7eb4a 7c0f9e16 2bce3357 6b315ece cbb64068 37bf51f5"]}),e("p384",{type:"short",prime:null,p:"ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ffffffff 00000000 00000000 ffffffff",a:"ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ffffffff 00000000 00000000 fffffffc",b:"b3312fa7 e23ee7e4 988e056b e3f82d19 181d9c6e fe814112 0314088f 5013875a c656398d 8a2ed19d 2a85c8ed d3ec2aef",n:"ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff c7634d81 f4372ddf 581a0db2 48b0a77a ecec196a ccc52973",hash:g.sha384,gRed:!1,g:["aa87ca22 be8b0537 8eb1c71e f320ad74 6e1d3b62 8ba79b98 59f741e0 82542a38 5502f25d bf55296c 3a545e38 72760ab7","3617de4a 96262c6f 5d9e98bf 9292dc29 f8f41dbd 289a147c e9da3113 b5f0b8c0 0a60b1ce 1d7e819d 7a431d7c 90ea0e5f"]}),e("p521",{type:"short",prime:null,p:"000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff",a:"000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffc",b:"00000051 953eb961 8e1c9a1f 929a21a0 b68540ee a2da725b 99b315f3 b8b48991 8ef109e1 56193951 ec7e937b 1652c0bd 3bb1bf07 3573df88 3d2c34f1 ef451fd4 6b503f00",n:"000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffa 51868783 bf2f966b 7fcc0148 f709a5d0 3bb5c9b8 899c47ae bb6fb71e 91386409",hash:g.sha512,gRed:!1,g:["000000c6 858e06b7 0404e9cd 9e3ecb66 2395b442 9c648139 053fb521 f828af60 6b4d3dba a14b5e77 efe75928 fe1dc127 a2ffa8de 3348b3c1 856a429b f97e7e31 c2e5bd66","00000118 39296a78 9a3bc004 5c8a5fb4 2c7d1bd9 98f54449 579b4468 17afbd17 273e662c 97ee7299 5ef42640 c550b901 3fad0761 353c7086 a272c240 88be9476 9fd16650"]}),e("curve25519",{type:"mont",prime:"p25519",p:"7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed",a:"76d06",b:"1",n:"1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed",hash:g.sha256,gRed:!1,g:["9"]}),e("ed25519",{type:"edwards",prime:"p25519",p:"7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed",a:"-1",c:"1",d:"52036cee2b6ffe73 8cc740797779e898 00700a4d4141d8ab 75eb4dca135978a3",n:"1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed",hash:g.sha256,gRed:!1,g:["216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a","6666666666666666666666666666666666666666666666666666666666666658"]});var j;try{j=a("./precomputed/secp256k1")}catch(k){
j=void 0}e("secp256k1",{type:"short",prime:"k256",p:"ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f",a:"0",b:"7",n:"ffffffff ffffffff ffffffff fffffffe baaedce6 af48a03b bfd25e8c d0364141",h:"1",hash:g.sha256,beta:"7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee",lambda:"5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72",basis:[{a:"3086d221a7d46bcde86c90e49284eb15",b:"-e4437ed6010e88286f547fa90abfe4c3"},{a:"114ca50f7a8e2f3f657c1108d9d44cfd8",b:"3086d221a7d46bcde86c90e49284eb15"}],gRed:!1,g:["79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798","483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8",j]})},{"../elliptic":1,"./precomputed/secp256k1":14,"hash.js":19}],8:[function(a,b,c){"use strict";function d(a){return this instanceof d?("string"==typeof a&&(i(g.curves.hasOwnProperty(a),"Unknown curve "+a),a=g.curves[a]),a instanceof g.curves.PresetCurve&&(a={curve:a}),this.curve=a.curve.curve,this.n=this.curve.n,this.nh=this.n.ushrn(1),this.g=this.curve.g,this.g=a.curve.g,this.g.precompute(a.curve.n.bitLength()+1),void(this.hash=a.hash||a.curve.hash)):new d(a)}var e=a("bn.js"),f=a("hmac-drbg"),g=a("../../elliptic"),h=g.utils,i=h.assert,j=a("./key"),k=a("./signature");b.exports=d,d.prototype.keyPair=function(a){return new j(this,a)},d.prototype.keyFromPrivate=function(a,b){return j.fromPrivate(this,a,b)},d.prototype.keyFromPublic=function(a,b){return j.fromPublic(this,a,b)},d.prototype.genKeyPair=function(a){a||(a={});for(var b=new f({hash:this.hash,pers:a.pers,persEnc:a.persEnc||"utf8",entropy:a.entropy||g.rand(this.hash.hmacStrength),entropyEnc:a.entropy&&a.entropyEnc||"utf8",nonce:this.n.toArray()}),c=this.n.byteLength(),d=this.n.sub(new e(2));;){var h=new e(b.generate(c));if(!(h.cmp(d)>0))return h.iaddn(1),this.keyFromPrivate(h)}},d.prototype._truncateToN=function(a,b){var c=8*a.byteLength()-this.n.bitLength();return c>0&&(a=a.ushrn(c)),!b&&a.cmp(this.n)>=0?a.sub(this.n):a},d.prototype.sign=function(a,b,c,d){"object"==typeof c&&(d=c,c=null),d||(d={}),b=this.keyFromPrivate(b,c),a=this._truncateToN(new e(a,16));for(var g=this.n.byteLength(),h=b.getPrivate().toArray("be",g),i=a.toArray("be",g),j=new f({hash:this.hash,entropy:h,nonce:i,pers:d.pers,persEnc:d.persEnc||"utf8"}),l=this.n.sub(new e(1)),m=0;!0;m++){var n=d.k?d.k(m):new e(j.generate(this.n.byteLength()));if(n=this._truncateToN(n,!0),!(n.cmpn(1)<=0||n.cmp(l)>=0)){var o=this.g.mul(n);if(!o.isInfinity()){var p=o.getX(),q=p.umod(this.n);if(0!==q.cmpn(0)){var r=n.invm(this.n).mul(q.mul(b.getPrivate()).iadd(a));if(r=r.umod(this.n),0!==r.cmpn(0)){var s=(o.getY().isOdd()?1:0)|(0!==p.cmp(q)?2:0);return d.canonical&&r.cmp(this.nh)>0&&(r=this.n.sub(r),s^=1),new k({r:q,s:r,recoveryParam:s})}}}}}},d.prototype.verify=function(a,b,c,d){a=this._truncateToN(new e(a,16)),c=this.keyFromPublic(c,d),b=new k(b,"hex");var f=b.r,g=b.s;if(f.cmpn(1)<0||f.cmp(this.n)>=0)return!1;if(g.cmpn(1)<0||g.cmp(this.n)>=0)return!1;var h=g.invm(this.n),i=h.mul(a).umod(this.n),j=h.mul(f).umod(this.n);if(!this.curve._maxwellTrick){var l=this.g.mulAdd(i,c.getPublic(),j);return!l.isInfinity()&&0===l.getX().umod(this.n).cmp(f)}var l=this.g.jmulAdd(i,c.getPublic(),j);return!l.isInfinity()&&l.eqXToP(f)},d.prototype.recoverPubKey=function(a,b,c,d){i((3&c)===c,"The recovery param is more than two bits"),b=new k(b,d);var f=this.n,g=new e(a),h=b.r,j=b.s,l=1&c,m=c>>1;if(h.cmp(this.curve.p.umod(this.curve.n))>=0&&m)throw new Error("Unable to find sencond key candinate");h=m?this.curve.pointFromX(h.add(this.curve.n),l):this.curve.pointFromX(h,l);var n=b.r.invm(f),o=f.sub(g).mul(n).umod(f),p=j.mul(n).umod(f);return this.g.mulAdd(o,h,p)},d.prototype.getKeyRecoveryParam=function(a,b,c,d){if(b=new k(b,d),null!==b.recoveryParam)return b.recoveryParam;for(var e=0;e<4;e++){var f;try{f=this.recoverPubKey(a,b,e)}catch(a){continue}if(f.eq(c))return e}throw new Error("Unable to find valid recovery factor")}},{"../../elliptic":1,"./key":9,"./signature":10,"bn.js":16,"hmac-drbg":25}],9:[function(a,b,c){"use strict";function d(a,b){this.ec=a,this.priv=null,this.pub=null,b.priv&&this._importPrivate(b.priv,b.privEnc),b.pub&&this._importPublic(b.pub,b.pubEnc)}var e=a("bn.js"),f=a("../../elliptic"),g=f.utils,h=g.assert;b.exports=d,d.fromPublic=function(a,b,c){return b instanceof d?b:new d(a,{pub:b,pubEnc:c})},d.fromPrivate=function(a,b,c){return b instanceof d?b:new d(a,{priv:b,privEnc:c})},d.prototype.validate=function(){var a=this.getPublic();return a.isInfinity()?{result:!1,reason:"Invalid public key"}:a.validate()?a.mul(this.ec.curve.n).isInfinity()?{result:!0,reason:null}:{result:!1,reason:"Public key * N != O"}:{result:!1,reason:"Public key is not a point"}},d.prototype.getPublic=function(a,b){return"string"==typeof a&&(b=a,a=null),this.pub||(this.pub=this.ec.g.mul(this.priv)),b?this.pub.encode(b,a):this.pub},d.prototype.getPrivate=function(a){return"hex"===a?this.priv.toString(16,2):this.priv},d.prototype._importPrivate=function(a,b){this.priv=new e(a,b||16),this.priv=this.priv.umod(this.ec.curve.n)},d.prototype._importPublic=function(a,b){return a.x||a.y?("mont"===this.ec.curve.type?h(a.x,"Need x coordinate"):"short"!==this.ec.curve.type&&"edwards"!==this.ec.curve.type||h(a.x&&a.y,"Need both x and y coordinate"),void(this.pub=this.ec.curve.point(a.x,a.y))):void(this.pub=this.ec.curve.decodePoint(a,b))},d.prototype.derive=function(a){return a.mul(this.priv).getX()},d.prototype.sign=function(a,b,c){return this.ec.sign(a,this,b,c)},d.prototype.verify=function(a,b){return this.ec.verify(a,b,this)},d.prototype.inspect=function(){return"<Key priv: "+(this.priv&&this.priv.toString(16,2))+" pub: "+(this.pub&&this.pub.inspect())+" >"}},{"../../elliptic":1,"bn.js":16}],10:[function(a,b,c){"use strict";function d(a,b){return a instanceof d?a:void(this._importDER(a,b)||(l(a.r&&a.s,"Signature without r or s"),this.r=new i(a.r,16),this.s=new i(a.s,16),void 0===a.recoveryParam?this.recoveryParam=null:this.recoveryParam=a.recoveryParam))}function e(){this.place=0}function f(a,b){var c=a[b.place++];if(!(128&c))return c;for(var d=15&c,e=0,f=0,g=b.place;f<d;f++,g++)e<<=8,e|=a[g];return b.place=g,e}function g(a){for(var b=0,c=a.length-1;!a[b]&&!(128&a[b+1])&&b<c;)b++;return 0===b?a:a.slice(b)}function h(a,b){if(b<128)return void a.push(b);var c=1+(Math.log(b)/Math.LN2>>>3);for(a.push(128|c);--c;)a.push(b>>>(c<<3)&255);a.push(b)}var i=a("bn.js"),j=a("../../elliptic"),k=j.utils,l=k.assert;b.exports=d,d.prototype._importDER=function(a,b){a=k.toArray(a,b);var c=new e;if(48!==a[c.place++])return!1;var d=f(a,c);if(d+c.place!==a.length)return!1;if(2!==a[c.place++])return!1;var g=f(a,c),h=a.slice(c.place,g+c.place);if(c.place+=g,2!==a[c.place++])return!1;var j=f(a,c);if(a.length!==j+c.place)return!1;var l=a.slice(c.place,j+c.place);return 0===h[0]&&128&h[1]&&(h=h.slice(1)),0===l[0]&&128&l[1]&&(l=l.slice(1)),this.r=new i(h),this.s=new i(l),this.recoveryParam=null,!0},d.prototype.toDER=function(a){var b=this.r.toArray(),c=this.s.toArray();for(128&b[0]&&(b=[0].concat(b)),128&c[0]&&(c=[0].concat(c)),b=g(b),c=g(c);!(c[0]||128&c[1]);)c=c.slice(1);var d=[2];h(d,b.length),d=d.concat(b),d.push(2),h(d,c.length);var e=d.concat(c),f=[48];return h(f,e.length),f=f.concat(e),k.encode(f,a)}},{"../../elliptic":1,"bn.js":16}],11:[function(a,b,c){"use strict";function d(a){if(h("ed25519"===a,"only tested with ed25519 so far"),!(this instanceof d))return new d(a);var a=f.curves[a].curve;this.curve=a,this.g=a.g,this.g.precompute(a.n.bitLength()+1),this.pointClass=a.point().constructor,this.encodingLength=Math.ceil(a.n.bitLength()/8),this.hash=e.sha512}var e=a("hash.js"),f=a("../../elliptic"),g=f.utils,h=g.assert,i=g.parseBytes,j=a("./key"),k=a("./signature");b.exports=d,d.prototype.sign=function(a,b){a=i(a);var c=this.keyFromSecret(b),d=this.hashInt(c.messagePrefix(),a),e=this.g.mul(d),f=this.encodePoint(e),g=this.hashInt(f,c.pubBytes(),a).mul(c.priv()),h=d.add(g).umod(this.curve.n);return this.makeSignature({R:e,S:h,Rencoded:f})},d.prototype.verify=function(a,b,c){a=i(a),b=this.makeSignature(b);var d=this.keyFromPublic(c),e=this.hashInt(b.Rencoded(),d.pubBytes(),a),f=this.g.mul(b.S()),g=b.R().add(d.pub().mul(e));return g.eq(f)},d.prototype.hashInt=function(){for(var a=this.hash(),b=0;b<arguments.length;b++)a.update(arguments[b]);return g.intFromLE(a.digest()).umod(this.curve.n)},d.prototype.keyFromPublic=function(a){return j.fromPublic(this,a)},d.prototype.keyFromSecret=function(a){return j.fromSecret(this,a)},d.prototype.makeSignature=function(a){return a instanceof k?a:new k(this,a)},d.prototype.encodePoint=function(a){var b=a.getY().toArray("le",this.encodingLength);return b[this.encodingLength-1]|=a.getX().isOdd()?128:0,b},d.prototype.decodePoint=function(a){a=g.parseBytes(a);var b=a.length-1,c=a.slice(0,b).concat(a[b]&-129),d=0!==(128&a[b]),e=g.intFromLE(c);return this.curve.pointFromY(e,d)},d.prototype.encodeInt=function(a){return a.toArray("le",this.encodingLength)},d.prototype.decodeInt=function(a){return g.intFromLE(a)},d.prototype.isPoint=function(a){return a instanceof this.pointClass}},{"../../elliptic":1,"./key":12,"./signature":13,"hash.js":19}],12:[function(a,b,c){"use strict";function d(a,b){this.eddsa=a,this._secret=h(b.secret),a.isPoint(b.pub)?this._pub=b.pub:this._pubBytes=h(b.pub)}var e=a("../../elliptic"),f=e.utils,g=f.assert,h=f.parseBytes,i=f.cachedProperty;d.fromPublic=function(a,b){return b instanceof d?b:new d(a,{pub:b})},d.fromSecret=function(a,b){return b instanceof d?b:new d(a,{secret:b})},d.prototype.secret=function(){return this._secret},i(d,"pubBytes",function(){return this.eddsa.encodePoint(this.pub())}),i(d,"pub",function(){return this._pubBytes?this.eddsa.decodePoint(this._pubBytes):this.eddsa.g.mul(this.priv())}),i(d,"privBytes",function(){var a=this.eddsa,b=this.hash(),c=a.encodingLength-1,d=b.slice(0,a.encodingLength);return d[0]&=248,d[c]&=127,d[c]|=64,d}),i(d,"priv",function(){return this.eddsa.decodeInt(this.privBytes())}),i(d,"hash",function(){return this.eddsa.hash().update(this.secret()).digest()}),i(d,"messagePrefix",function(){return this.hash().slice(this.eddsa.encodingLength)}),d.prototype.sign=function(a){return g(this._secret,"KeyPair can only verify"),this.eddsa.sign(a,this)},d.prototype.verify=function(a,b){return this.eddsa.verify(a,b,this)},d.prototype.getSecret=function(a){return g(this._secret,"KeyPair is public only"),f.encode(this.secret(),a)},d.prototype.getPublic=function(a){return f.encode(this.pubBytes(),a)},b.exports=d},{"../../elliptic":1}],13:[function(a,b,c){"use strict";function d(a,b){this.eddsa=a,"object"!=typeof b&&(b=j(b)),Array.isArray(b)&&(b={R:b.slice(0,a.encodingLength),S:b.slice(a.encodingLength)}),h(b.R&&b.S,"Signature without R or S"),a.isPoint(b.R)&&(this._R=b.R),b.S instanceof e&&(this._S=b.S),this._Rencoded=Array.isArray(b.R)?b.R:b.Rencoded,this._Sencoded=Array.isArray(b.S)?b.S:b.Sencoded}var e=a("bn.js"),f=a("../../elliptic"),g=f.utils,h=g.assert,i=g.cachedProperty,j=g.parseBytes;i(d,"S",function(){return this.eddsa.decodeInt(this.Sencoded())}),i(d,"R",function(){return this.eddsa.decodePoint(this.Rencoded())}),i(d,"Rencoded",function(){return this.eddsa.encodePoint(this.R())}),i(d,"Sencoded",function(){return this.eddsa.encodeInt(this.S())}),d.prototype.toBytes=function(){return this.Rencoded().concat(this.Sencoded())},d.prototype.toHex=function(){return g.encode(this.toBytes(),"hex").toUpperCase()},b.exports=d},{"../../elliptic":1,"bn.js":16}],14:[function(a,b,c){b.exports={doubles:{step:4,points:[["e60fce93b59e9ec53011aabc21c23e97b2a31369b87a5ae9c44ee89e2a6dec0a","f7e3507399e595929db99f34f57937101296891e44d23f0be1f32cce69616821"],["8282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508","11f8a8098557dfe45e8256e830b60ace62d613ac2f7b17bed31b6eaff6e26caf"],["175e159f728b865a72f99cc6c6fc846de0b93833fd2222ed73fce5b551e5b739","d3506e0d9e3c79eba4ef97a51ff71f5eacb5955add24345c6efa6ffee9fed695"],["363d90d447b00c9c99ceac05b6262ee053441c7e55552ffe526bad8f83ff4640","4e273adfc732221953b445397f3363145b9a89008199ecb62003c7f3bee9de9"],["8b4b5f165df3c2be8c6244b5b745638843e4a781a15bcd1b69f79a55dffdf80c","4aad0a6f68d308b4b3fbd7813ab0da04f9e336546162ee56b3eff0c65fd4fd36"],["723cbaa6e5db996d6bf771c00bd548c7b700dbffa6c0e77bcb6115925232fcda","96e867b5595cc498a921137488824d6e2660a0653779494801dc069d9eb39f5f"],["eebfa4d493bebf98ba5feec812c2d3b50947961237a919839a533eca0e7dd7fa","5d9a8ca3970ef0f269ee7edaf178089d9ae4cdc3a711f712ddfd4fdae1de8999"],["100f44da696e71672791d0a09b7bde459f1215a29b3c03bfefd7835b39a48db0","cdd9e13192a00b772ec8f3300c090666b7ff4a18ff5195ac0fbd5cd62bc65a09"],["e1031be262c7ed1b1dc9227a4a04c017a77f8d4464f3b3852c8acde6e534fd2d","9d7061928940405e6bb6a4176597535af292dd419e1ced79a44f18f29456a00d"],["feea6cae46d55b530ac2839f143bd7ec5cf8b266a41d6af52d5e688d9094696d","e57c6b6c97dce1bab06e4e12bf3ecd5c981c8957cc41442d3155debf18090088"],["da67a91d91049cdcb367be4be6ffca3cfeed657d808583de33fa978bc1ec6cb1","9bacaa35481642bc41f463f7ec9780e5dec7adc508f740a17e9ea8e27a68be1d"],["53904faa0b334cdda6e000935ef22151ec08d0f7bb11069f57545ccc1a37b7c0","5bc087d0bc80106d88c9eccac20d3c1c13999981e14434699dcb096b022771c8"],["8e7bcd0bd35983a7719cca7764ca906779b53a043a9b8bcaeff959f43ad86047","10b7770b2a3da4b3940310420ca9514579e88e2e47fd68b3ea10047e8460372a"],["385eed34c1cdff21e6d0818689b81bde71a7f4f18397e6690a841e1599c43862","283bebc3e8ea23f56701de19e9ebf4576b304eec2086dc8cc0458fe5542e5453"],["6f9d9b803ecf191637c73a4413dfa180fddf84a5947fbc9c606ed86c3fac3a7","7c80c68e603059ba69b8e2a30e45c4d47ea4dd2f5c281002d86890603a842160"],["3322d401243c4e2582a2147c104d6ecbf774d163db0f5e5313b7e0e742d0e6bd","56e70797e9664ef5bfb019bc4ddaf9b72805f63ea2873af624f3a2e96c28b2a0"],["85672c7d2de0b7da2bd1770d89665868741b3f9af7643397721d74d28134ab83","7c481b9b5b43b2eb6374049bfa62c2e5e77f17fcc5298f44c8e3094f790313a6"],["948bf809b1988a46b06c9f1919413b10f9226c60f668832ffd959af60c82a0a","53a562856dcb6646dc6b74c5d1c3418c6d4dff08c97cd2bed4cb7f88d8c8e589"],["6260ce7f461801c34f067ce0f02873a8f1b0e44dfc69752accecd819f38fd8e8","bc2da82b6fa5b571a7f09049776a1ef7ecd292238051c198c1a84e95b2b4ae17"],["e5037de0afc1d8d43d8348414bbf4103043ec8f575bfdc432953cc8d2037fa2d","4571534baa94d3b5f9f98d09fb990bddbd5f5b03ec481f10e0e5dc841d755bda"],["e06372b0f4a207adf5ea905e8f1771b4e7e8dbd1c6a6c5b725866a0ae4fce725","7a908974bce18cfe12a27bb2ad5a488cd7484a7787104870b27034f94eee31dd"],["213c7a715cd5d45358d0bbf9dc0ce02204b10bdde2a3f58540ad6908d0559754","4b6dad0b5ae462507013ad06245ba190bb4850f5f36a7eeddff2c27534b458f2"],["4e7c272a7af4b34e8dbb9352a5419a87e2838c70adc62cddf0cc3a3b08fbd53c","17749c766c9d0b18e16fd09f6def681b530b9614bff7dd33e0b3941817dcaae6"],["fea74e3dbe778b1b10f238ad61686aa5c76e3db2be43057632427e2840fb27b6","6e0568db9b0b13297cf674deccb6af93126b596b973f7b77701d3db7f23cb96f"],["76e64113f677cf0e10a2570d599968d31544e179b760432952c02a4417bdde39","c90ddf8dee4e95cf577066d70681f0d35e2a33d2b56d2032b4b1752d1901ac01"],["c738c56b03b2abe1e8281baa743f8f9a8f7cc643df26cbee3ab150242bcbb891","893fb578951ad2537f718f2eacbfbbbb82314eef7880cfe917e735d9699a84c3"],["d895626548b65b81e264c7637c972877d1d72e5f3a925014372e9f6588f6c14b","febfaa38f2bc7eae728ec60818c340eb03428d632bb067e179363ed75d7d991f"],["b8da94032a957518eb0f6433571e8761ceffc73693e84edd49150a564f676e03","2804dfa44805a1e4d7c99cc9762808b092cc584d95ff3b511488e4e74efdf6e7"],["e80fea14441fb33a7d8adab9475d7fab2019effb5156a792f1a11778e3c0df5d","eed1de7f638e00771e89768ca3ca94472d155e80af322ea9fcb4291b6ac9ec78"],["a301697bdfcd704313ba48e51d567543f2a182031efd6915ddc07bbcc4e16070","7370f91cfb67e4f5081809fa25d40f9b1735dbf7c0a11a130c0d1a041e177ea1"],["90ad85b389d6b936463f9d0512678de208cc330b11307fffab7ac63e3fb04ed4","e507a3620a38261affdcbd9427222b839aefabe1582894d991d4d48cb6ef150"],["8f68b9d2f63b5f339239c1ad981f162ee88c5678723ea3351b7b444c9ec4c0da","662a9f2dba063986de1d90c2b6be215dbbea2cfe95510bfdf23cbf79501fff82"],["e4f3fb0176af85d65ff99ff9198c36091f48e86503681e3e6686fd5053231e11","1e63633ad0ef4f1c1661a6d0ea02b7286cc7e74ec951d1c9822c38576feb73bc"],["8c00fa9b18ebf331eb961537a45a4266c7034f2f0d4e1d0716fb6eae20eae29e","efa47267fea521a1a9dc343a3736c974c2fadafa81e36c54e7d2a4c66702414b"],["e7a26ce69dd4829f3e10cec0a9e98ed3143d084f308b92c0997fddfc60cb3e41","2a758e300fa7984b471b006a1aafbb18d0a6b2c0420e83e20e8a9421cf2cfd51"],["b6459e0ee3662ec8d23540c223bcbdc571cbcb967d79424f3cf29eb3de6b80ef","67c876d06f3e06de1dadf16e5661db3c4b3ae6d48e35b2ff30bf0b61a71ba45"],["d68a80c8280bb840793234aa118f06231d6f1fc67e73c5a5deda0f5b496943e8","db8ba9fff4b586d00c4b1f9177b0e28b5b0e7b8f7845295a294c84266b133120"],["324aed7df65c804252dc0270907a30b09612aeb973449cea4095980fc28d3d5d","648a365774b61f2ff130c0c35aec1f4f19213b0c7e332843967224af96ab7c84"],["4df9c14919cde61f6d51dfdbe5fee5dceec4143ba8d1ca888e8bd373fd054c96","35ec51092d8728050974c23a1d85d4b5d506cdc288490192ebac06cad10d5d"],["9c3919a84a474870faed8a9c1cc66021523489054d7f0308cbfc99c8ac1f98cd","ddb84f0f4a4ddd57584f044bf260e641905326f76c64c8e6be7e5e03d4fc599d"],["6057170b1dd12fdf8de05f281d8e06bb91e1493a8b91d4cc5a21382120a959e5","9a1af0b26a6a4807add9a2daf71df262465152bc3ee24c65e899be932385a2a8"],["a576df8e23a08411421439a4518da31880cef0fba7d4df12b1a6973eecb94266","40a6bf20e76640b2c92b97afe58cd82c432e10a7f514d9f3ee8be11ae1b28ec8"],["7778a78c28dec3e30a05fe9629de8c38bb30d1f5cf9a3a208f763889be58ad71","34626d9ab5a5b22ff7098e12f2ff580087b38411ff24ac563b513fc1fd9f43ac"],["928955ee637a84463729fd30e7afd2ed5f96274e5ad7e5cb09eda9c06d903ac","c25621003d3f42a827b78a13093a95eeac3d26efa8a8d83fc5180e935bcd091f"],["85d0fef3ec6db109399064f3a0e3b2855645b4a907ad354527aae75163d82751","1f03648413a38c0be29d496e582cf5663e8751e96877331582c237a24eb1f962"],["ff2b0dce97eece97c1c9b6041798b85dfdfb6d8882da20308f5404824526087e","493d13fef524ba188af4c4dc54d07936c7b7ed6fb90e2ceb2c951e01f0c29907"],["827fbbe4b1e880ea9ed2b2e6301b212b57f1ee148cd6dd28780e5e2cf856e241","c60f9c923c727b0b71bef2c67d1d12687ff7a63186903166d605b68baec293ec"],["eaa649f21f51bdbae7be4ae34ce6e5217a58fdce7f47f9aa7f3b58fa2120e2b3","be3279ed5bbbb03ac69a80f89879aa5a01a6b965f13f7e59d47a5305ba5ad93d"],["e4a42d43c5cf169d9391df6decf42ee541b6d8f0c9a137401e23632dda34d24f","4d9f92e716d1c73526fc99ccfb8ad34ce886eedfa8d8e4f13a7f7131deba9414"],["1ec80fef360cbdd954160fadab352b6b92b53576a88fea4947173b9d4300bf19","aeefe93756b5340d2f3a4958a7abbf5e0146e77f6295a07b671cdc1cc107cefd"],["146a778c04670c2f91b00af4680dfa8bce3490717d58ba889ddb5928366642be","b318e0ec3354028add669827f9d4b2870aaa971d2f7e5ed1d0b297483d83efd0"],["fa50c0f61d22e5f07e3acebb1aa07b128d0012209a28b9776d76a8793180eef9","6b84c6922397eba9b72cd2872281a68a5e683293a57a213b38cd8d7d3f4f2811"],["da1d61d0ca721a11b1a5bf6b7d88e8421a288ab5d5bba5220e53d32b5f067ec2","8157f55a7c99306c79c0766161c91e2966a73899d279b48a655fba0f1ad836f1"],["a8e282ff0c9706907215ff98e8fd416615311de0446f1e062a73b0610d064e13","7f97355b8db81c09abfb7f3c5b2515888b679a3e50dd6bd6cef7c73111f4cc0c"],["174a53b9c9a285872d39e56e6913cab15d59b1fa512508c022f382de8319497c","ccc9dc37abfc9c1657b4155f2c47f9e6646b3a1d8cb9854383da13ac079afa73"],["959396981943785c3d3e57edf5018cdbe039e730e4918b3d884fdff09475b7ba","2e7e552888c331dd8ba0386a4b9cd6849c653f64c8709385e9b8abf87524f2fd"],["d2a63a50ae401e56d645a1153b109a8fcca0a43d561fba2dbb51340c9d82b151","e82d86fb6443fcb7565aee58b2948220a70f750af484ca52d4142174dcf89405"],["64587e2335471eb890ee7896d7cfdc866bacbdbd3839317b3436f9b45617e073","d99fcdd5bf6902e2ae96dd6447c299a185b90a39133aeab358299e5e9faf6589"],["8481bde0e4e4d885b3a546d3e549de042f0aa6cea250e7fd358d6c86dd45e458","38ee7b8cba5404dd84a25bf39cecb2ca900a79c42b262e556d64b1b59779057e"],["13464a57a78102aa62b6979ae817f4637ffcfed3c4b1ce30bcd6303f6caf666b","69be159004614580ef7e433453ccb0ca48f300a81d0942e13f495a907f6ecc27"],["bc4a9df5b713fe2e9aef430bcc1dc97a0cd9ccede2f28588cada3a0d2d83f366","d3a81ca6e785c06383937adf4b798caa6e8a9fbfa547b16d758d666581f33c1"],["8c28a97bf8298bc0d23d8c749452a32e694b65e30a9472a3954ab30fe5324caa","40a30463a3305193378fedf31f7cc0eb7ae784f0451cb9459e71dc73cbef9482"],["8ea9666139527a8c1dd94ce4f071fd23c8b350c5a4bb33748c4ba111faccae0","620efabbc8ee2782e24e7c0cfb95c5d735b783be9cf0f8e955af34a30e62b945"],["dd3625faef5ba06074669716bbd3788d89bdde815959968092f76cc4eb9a9787","7a188fa3520e30d461da2501045731ca941461982883395937f68d00c644a573"],["f710d79d9eb962297e4f6232b40e8f7feb2bc63814614d692c12de752408221e","ea98e67232d3b3295d3b535532115ccac8612c721851617526ae47a9c77bfc82"]]},naf:{wnd:7,points:[["f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9","388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672"],["2f8bde4d1a07209355b4a7250a5c5128e88b84bddc619ab7cba8d569b240efe4","d8ac222636e5e3d6d4dba9dda6c9c426f788271bab0d6840dca87d3aa6ac62d6"],["5cbdf0646e5db4eaa398f365f2ea7a0e3d419b7e0330e39ce92bddedcac4f9bc","6aebca40ba255960a3178d6d861a54dba813d0b813fde7b5a5082628087264da"],["acd484e2f0c7f65309ad178a9f559abde09796974c57e714c35f110dfc27ccbe","cc338921b0a7d9fd64380971763b61e9add888a4375f8e0f05cc262ac64f9c37"],["774ae7f858a9411e5ef4246b70c65aac5649980be5c17891bbec17895da008cb","d984a032eb6b5e190243dd56d7b7b365372db1e2dff9d6a8301d74c9c953c61b"],["f28773c2d975288bc7d1d205c3748651b075fbc6610e58cddeeddf8f19405aa8","ab0902e8d880a89758212eb65cdaf473a1a06da521fa91f29b5cb52db03ed81"],["d7924d4f7d43ea965a465ae3095ff41131e5946f3c85f79e44adbcf8e27e080e","581e2872a86c72a683842ec228cc6defea40af2bd896d3a5c504dc9ff6a26b58"],["defdea4cdb677750a420fee807eacf21eb9898ae79b9768766e4faa04a2d4a34","4211ab0694635168e997b0ead2a93daeced1f4a04a95c0f6cfb199f69e56eb77"],["2b4ea0a797a443d293ef5cff444f4979f06acfebd7e86d277475656138385b6c","85e89bc037945d93b343083b5a1c86131a01f60c50269763b570c854e5c09b7a"],["352bbf4a4cdd12564f93fa332ce333301d9ad40271f8107181340aef25be59d5","321eb4075348f534d59c18259dda3e1f4a1b3b2e71b1039c67bd3d8bcf81998c"],["2fa2104d6b38d11b0230010559879124e42ab8dfeff5ff29dc9cdadd4ecacc3f","2de1068295dd865b64569335bd5dd80181d70ecfc882648423ba76b532b7d67"],["9248279b09b4d68dab21a9b066edda83263c3d84e09572e269ca0cd7f5453714","73016f7bf234aade5d1aa71bdea2b1ff3fc0de2a887912ffe54a32ce97cb3402"],["daed4f2be3a8bf278e70132fb0beb7522f570e144bf615c07e996d443dee8729","a69dce4a7d6c98e8d4a1aca87ef8d7003f83c230f3afa726ab40e52290be1c55"],["c44d12c7065d812e8acf28d7cbb19f9011ecd9e9fdf281b0e6a3b5e87d22e7db","2119a460ce326cdc76c45926c982fdac0e106e861edf61c5a039063f0e0e6482"],["6a245bf6dc698504c89a20cfded60853152b695336c28063b61c65cbd269e6b4","e022cf42c2bd4a708b3f5126f16a24ad8b33ba48d0423b6efd5e6348100d8a82"],["1697ffa6fd9de627c077e3d2fe541084ce13300b0bec1146f95ae57f0d0bd6a5","b9c398f186806f5d27561506e4557433a2cf15009e498ae7adee9d63d01b2396"],["605bdb019981718b986d0f07e834cb0d9deb8360ffb7f61df982345ef27a7479","2972d2de4f8d20681a78d93ec96fe23c26bfae84fb14db43b01e1e9056b8c49"],["62d14dab4150bf497402fdc45a215e10dcb01c354959b10cfe31c7e9d87ff33d","80fc06bd8cc5b01098088a1950eed0db01aa132967ab472235f5642483b25eaf"],["80c60ad0040f27dade5b4b06c408e56b2c50e9f56b9b8b425e555c2f86308b6f","1c38303f1cc5c30f26e66bad7fe72f70a65eed4cbe7024eb1aa01f56430bd57a"],["7a9375ad6167ad54aa74c6348cc54d344cc5dc9487d847049d5eabb0fa03c8fb","d0e3fa9eca8726909559e0d79269046bdc59ea10c70ce2b02d499ec224dc7f7"],["d528ecd9b696b54c907a9ed045447a79bb408ec39b68df504bb51f459bc3ffc9","eecf41253136e5f99966f21881fd656ebc4345405c520dbc063465b521409933"],["49370a4b5f43412ea25f514e8ecdad05266115e4a7ecb1387231808f8b45963","758f3f41afd6ed428b3081b0512fd62a54c3f3afbb5b6764b653052a12949c9a"],["77f230936ee88cbbd73df930d64702ef881d811e0e1498e2f1c13eb1fc345d74","958ef42a7886b6400a08266e9ba1b37896c95330d97077cbbe8eb3c7671c60d6"],["f2dac991cc4ce4b9ea44887e5c7c0bce58c80074ab9d4dbaeb28531b7739f530","e0dedc9b3b2f8dad4da1f32dec2531df9eb5fbeb0598e4fd1a117dba703a3c37"],["463b3d9f662621fb1b4be8fbbe2520125a216cdfc9dae3debcba4850c690d45b","5ed430d78c296c3543114306dd8622d7c622e27c970a1de31cb377b01af7307e"],["f16f804244e46e2a09232d4aff3b59976b98fac14328a2d1a32496b49998f247","cedabd9b82203f7e13d206fcdf4e33d92a6c53c26e5cce26d6579962c4e31df6"],["caf754272dc84563b0352b7a14311af55d245315ace27c65369e15f7151d41d1","cb474660ef35f5f2a41b643fa5e460575f4fa9b7962232a5c32f908318a04476"],["2600ca4b282cb986f85d0f1709979d8b44a09c07cb86d7c124497bc86f082120","4119b88753c15bd6a693b03fcddbb45d5ac6be74ab5f0ef44b0be9475a7e4b40"],["7635ca72d7e8432c338ec53cd12220bc01c48685e24f7dc8c602a7746998e435","91b649609489d613d1d5e590f78e6d74ecfc061d57048bad9e76f302c5b9c61"],["754e3239f325570cdbbf4a87deee8a66b7f2b33479d468fbc1a50743bf56cc18","673fb86e5bda30fb3cd0ed304ea49a023ee33d0197a695d0c5d98093c536683"],["e3e6bd1071a1e96aff57859c82d570f0330800661d1c952f9fe2694691d9b9e8","59c9e0bba394e76f40c0aa58379a3cb6a5a2283993e90c4167002af4920e37f5"],["186b483d056a033826ae73d88f732985c4ccb1f32ba35f4b4cc47fdcf04aa6eb","3b952d32c67cf77e2e17446e204180ab21fb8090895138b4a4a797f86e80888b"],["df9d70a6b9876ce544c98561f4be4f725442e6d2b737d9c91a8321724ce0963f","55eb2dafd84d6ccd5f862b785dc39d4ab157222720ef9da217b8c45cf2ba2417"],["5edd5cc23c51e87a497ca815d5dce0f8ab52554f849ed8995de64c5f34ce7143","efae9c8dbc14130661e8cec030c89ad0c13c66c0d17a2905cdc706ab7399a868"],["290798c2b6476830da12fe02287e9e777aa3fba1c355b17a722d362f84614fba","e38da76dcd440621988d00bcf79af25d5b29c094db2a23146d003afd41943e7a"],["af3c423a95d9f5b3054754efa150ac39cd29552fe360257362dfdecef4053b45","f98a3fd831eb2b749a93b0e6f35cfb40c8cd5aa667a15581bc2feded498fd9c6"],["766dbb24d134e745cccaa28c99bf274906bb66b26dcf98df8d2fed50d884249a","744b1152eacbe5e38dcc887980da38b897584a65fa06cedd2c924f97cbac5996"],["59dbf46f8c94759ba21277c33784f41645f7b44f6c596a58ce92e666191abe3e","c534ad44175fbc300f4ea6ce648309a042ce739a7919798cd85e216c4a307f6e"],["f13ada95103c4537305e691e74e9a4a8dd647e711a95e73cb62dc6018cfd87b8","e13817b44ee14de663bf4bc808341f326949e21a6a75c2570778419bdaf5733d"],["7754b4fa0e8aced06d4167a2c59cca4cda1869c06ebadfb6488550015a88522c","30e93e864e669d82224b967c3020b8fa8d1e4e350b6cbcc537a48b57841163a2"],["948dcadf5990e048aa3874d46abef9d701858f95de8041d2a6828c99e2262519","e491a42537f6e597d5d28a3224b1bc25df9154efbd2ef1d2cbba2cae5347d57e"],["7962414450c76c1689c7b48f8202ec37fb224cf5ac0bfa1570328a8a3d7c77ab","100b610ec4ffb4760d5c1fc133ef6f6b12507a051f04ac5760afa5b29db83437"],["3514087834964b54b15b160644d915485a16977225b8847bb0dd085137ec47ca","ef0afbb2056205448e1652c48e8127fc6039e77c15c2378b7e7d15a0de293311"],["d3cc30ad6b483e4bc79ce2c9dd8bc54993e947eb8df787b442943d3f7b527eaf","8b378a22d827278d89c5e9be8f9508ae3c2ad46290358630afb34db04eede0a4"],["1624d84780732860ce1c78fcbfefe08b2b29823db913f6493975ba0ff4847610","68651cf9b6da903e0914448c6cd9d4ca896878f5282be4c8cc06e2a404078575"],["733ce80da955a8a26902c95633e62a985192474b5af207da6df7b4fd5fc61cd4","f5435a2bd2badf7d485a4d8b8db9fcce3e1ef8e0201e4578c54673bc1dc5ea1d"],["15d9441254945064cf1a1c33bbd3b49f8966c5092171e699ef258dfab81c045c","d56eb30b69463e7234f5137b73b84177434800bacebfc685fc37bbe9efe4070d"],["a1d0fcf2ec9de675b612136e5ce70d271c21417c9d2b8aaaac138599d0717940","edd77f50bcb5a3cab2e90737309667f2641462a54070f3d519212d39c197a629"],["e22fbe15c0af8ccc5780c0735f84dbe9a790badee8245c06c7ca37331cb36980","a855babad5cd60c88b430a69f53a1a7a38289154964799be43d06d77d31da06"],["311091dd9860e8e20ee13473c1155f5f69635e394704eaa74009452246cfa9b3","66db656f87d1f04fffd1f04788c06830871ec5a64feee685bd80f0b1286d8374"],["34c1fd04d301be89b31c0442d3e6ac24883928b45a9340781867d4232ec2dbdf","9414685e97b1b5954bd46f730174136d57f1ceeb487443dc5321857ba73abee"],["f219ea5d6b54701c1c14de5b557eb42a8d13f3abbcd08affcc2a5e6b049b8d63","4cb95957e83d40b0f73af4544cccf6b1f4b08d3c07b27fb8d8c2962a400766d1"],["d7b8740f74a8fbaab1f683db8f45de26543a5490bca627087236912469a0b448","fa77968128d9c92ee1010f337ad4717eff15db5ed3c049b3411e0315eaa4593b"],["32d31c222f8f6f0ef86f7c98d3a3335ead5bcd32abdd94289fe4d3091aa824bf","5f3032f5892156e39ccd3d7915b9e1da2e6dac9e6f26e961118d14b8462e1661"],["7461f371914ab32671045a155d9831ea8793d77cd59592c4340f86cbc18347b5","8ec0ba238b96bec0cbdddcae0aa442542eee1ff50c986ea6b39847b3cc092ff6"],["ee079adb1df1860074356a25aa38206a6d716b2c3e67453d287698bad7b2b2d6","8dc2412aafe3be5c4c5f37e0ecc5f9f6a446989af04c4e25ebaac479ec1c8c1e"],["16ec93e447ec83f0467b18302ee620f7e65de331874c9dc72bfd8616ba9da6b5","5e4631150e62fb40d0e8c2a7ca5804a39d58186a50e497139626778e25b0674d"],["eaa5f980c245f6f038978290afa70b6bd8855897f98b6aa485b96065d537bd99","f65f5d3e292c2e0819a528391c994624d784869d7e6ea67fb18041024edc07dc"],["78c9407544ac132692ee1910a02439958ae04877151342ea96c4b6b35a49f51","f3e0319169eb9b85d5404795539a5e68fa1fbd583c064d2462b675f194a3ddb4"],["494f4be219a1a77016dcd838431aea0001cdc8ae7a6fc688726578d9702857a5","42242a969283a5f339ba7f075e36ba2af925ce30d767ed6e55f4b031880d562c"],["a598a8030da6d86c6bc7f2f5144ea549d28211ea58faa70ebf4c1e665c1fe9b5","204b5d6f84822c307e4b4a7140737aec23fc63b65b35f86a10026dbd2d864e6b"],["c41916365abb2b5d09192f5f2dbeafec208f020f12570a184dbadc3e58595997","4f14351d0087efa49d245b328984989d5caf9450f34bfc0ed16e96b58fa9913"],["841d6063a586fa475a724604da03bc5b92a2e0d2e0a36acfe4c73a5514742881","73867f59c0659e81904f9a1c7543698e62562d6744c169ce7a36de01a8d6154"],["5e95bb399a6971d376026947f89bde2f282b33810928be4ded112ac4d70e20d5","39f23f366809085beebfc71181313775a99c9aed7d8ba38b161384c746012865"],["36e4641a53948fd476c39f8a99fd974e5ec07564b5315d8bf99471bca0ef2f66","d2424b1b1abe4eb8164227b085c9aa9456ea13493fd563e06fd51cf5694c78fc"],["336581ea7bfbbb290c191a2f507a41cf5643842170e914faeab27c2c579f726","ead12168595fe1be99252129b6e56b3391f7ab1410cd1e0ef3dcdcabd2fda224"],["8ab89816dadfd6b6a1f2634fcf00ec8403781025ed6890c4849742706bd43ede","6fdcef09f2f6d0a044e654aef624136f503d459c3e89845858a47a9129cdd24e"],["1e33f1a746c9c5778133344d9299fcaa20b0938e8acff2544bb40284b8c5fb94","60660257dd11b3aa9c8ed618d24edff2306d320f1d03010e33a7d2057f3b3b6"],["85b7c1dcb3cec1b7ee7f30ded79dd20a0ed1f4cc18cbcfcfa410361fd8f08f31","3d98a9cdd026dd43f39048f25a8847f4fcafad1895d7a633c6fed3c35e999511"],["29df9fbd8d9e46509275f4b125d6d45d7fbe9a3b878a7af872a2800661ac5f51","b4c4fe99c775a606e2d8862179139ffda61dc861c019e55cd2876eb2a27d84b"],["a0b1cae06b0a847a3fea6e671aaf8adfdfe58ca2f768105c8082b2e449fce252","ae434102edde0958ec4b19d917a6a28e6b72da1834aff0e650f049503a296cf2"],["4e8ceafb9b3e9a136dc7ff67e840295b499dfb3b2133e4ba113f2e4c0e121e5","cf2174118c8b6d7a4b48f6d534ce5c79422c086a63460502b827ce62a326683c"],["d24a44e047e19b6f5afb81c7ca2f69080a5076689a010919f42725c2b789a33b","6fb8d5591b466f8fc63db50f1c0f1c69013f996887b8244d2cdec417afea8fa3"],["ea01606a7a6c9cdd249fdfcfacb99584001edd28abbab77b5104e98e8e3b35d4","322af4908c7312b0cfbfe369f7a7b3cdb7d4494bc2823700cfd652188a3ea98d"],["af8addbf2b661c8a6c6328655eb96651252007d8c5ea31be4ad196de8ce2131f","6749e67c029b85f52a034eafd096836b2520818680e26ac8f3dfbcdb71749700"],["e3ae1974566ca06cc516d47e0fb165a674a3dabcfca15e722f0e3450f45889","2aeabe7e4531510116217f07bf4d07300de97e4874f81f533420a72eeb0bd6a4"],["591ee355313d99721cf6993ffed1e3e301993ff3ed258802075ea8ced397e246","b0ea558a113c30bea60fc4775460c7901ff0b053d25ca2bdeee98f1a4be5d196"],["11396d55fda54c49f19aa97318d8da61fa8584e47b084945077cf03255b52984","998c74a8cd45ac01289d5833a7beb4744ff536b01b257be4c5767bea93ea57a4"],["3c5d2a1ba39c5a1790000738c9e0c40b8dcdfd5468754b6405540157e017aa7a","b2284279995a34e2f9d4de7396fc18b80f9b8b9fdd270f6661f79ca4c81bd257"],["cc8704b8a60a0defa3a99a7299f2e9c3fbc395afb04ac078425ef8a1793cc030","bdd46039feed17881d1e0862db347f8cf395b74fc4bcdc4e940b74e3ac1f1b13"],["c533e4f7ea8555aacd9777ac5cad29b97dd4defccc53ee7ea204119b2889b197","6f0a256bc5efdf429a2fb6242f1a43a2d9b925bb4a4b3a26bb8e0f45eb596096"],["c14f8f2ccb27d6f109f6d08d03cc96a69ba8c34eec07bbcf566d48e33da6593","c359d6923bb398f7fd4473e16fe1c28475b740dd098075e6c0e8649113dc3a38"],["a6cbc3046bc6a450bac24789fa17115a4c9739ed75f8f21ce441f72e0b90e6ef","21ae7f4680e889bb130619e2c0f95a360ceb573c70603139862afd617fa9b9f"],["347d6d9a02c48927ebfb86c1359b1caf130a3c0267d11ce6344b39f99d43cc38","60ea7f61a353524d1c987f6ecec92f086d565ab687870cb12689ff1e31c74448"],["da6545d2181db8d983f7dcb375ef5866d47c67b1bf31c8cf855ef7437b72656a","49b96715ab6878a79e78f07ce5680c5d6673051b4935bd897fea824b77dc208a"],["c40747cc9d012cb1a13b8148309c6de7ec25d6945d657146b9d5994b8feb1111","5ca560753be2a12fc6de6caf2cb489565db936156b9514e1bb5e83037e0fa2d4"],["4e42c8ec82c99798ccf3a610be870e78338c7f713348bd34c8203ef4037f3502","7571d74ee5e0fb92a7a8b33a07783341a5492144cc54bcc40a94473693606437"],["3775ab7089bc6af823aba2e1af70b236d251cadb0c86743287522a1b3b0dedea","be52d107bcfa09d8bcb9736a828cfa7fac8db17bf7a76a2c42ad961409018cf7"],["cee31cbf7e34ec379d94fb814d3d775ad954595d1314ba8846959e3e82f74e26","8fd64a14c06b589c26b947ae2bcf6bfa0149ef0be14ed4d80f448a01c43b1c6d"],["b4f9eaea09b6917619f6ea6a4eb5464efddb58fd45b1ebefcdc1a01d08b47986","39e5c9925b5a54b07433a4f18c61726f8bb131c012ca542eb24a8ac07200682a"],["d4263dfc3d2df923a0179a48966d30ce84e2515afc3dccc1b77907792ebcc60e","62dfaf07a0f78feb30e30d6295853ce189e127760ad6cf7fae164e122a208d54"],["48457524820fa65a4f8d35eb6930857c0032acc0a4a2de422233eeda897612c4","25a748ab367979d98733c38a1fa1c2e7dc6cc07db2d60a9ae7a76aaa49bd0f77"],["dfeeef1881101f2cb11644f3a2afdfc2045e19919152923f367a1767c11cceda","ecfb7056cf1de042f9420bab396793c0c390bde74b4bbdff16a83ae09a9a7517"],["6d7ef6b17543f8373c573f44e1f389835d89bcbc6062ced36c82df83b8fae859","cd450ec335438986dfefa10c57fea9bcc521a0959b2d80bbf74b190dca712d10"],["e75605d59102a5a2684500d3b991f2e3f3c88b93225547035af25af66e04541f","f5c54754a8f71ee540b9b48728473e314f729ac5308b06938360990e2bfad125"],["eb98660f4c4dfaa06a2be453d5020bc99a0c2e60abe388457dd43fefb1ed620c","6cb9a8876d9cb8520609af3add26cd20a0a7cd8a9411131ce85f44100099223e"],["13e87b027d8514d35939f2e6892b19922154596941888336dc3563e3b8dba942","fef5a3c68059a6dec5d624114bf1e91aac2b9da568d6abeb2570d55646b8adf1"],["ee163026e9fd6fe017c38f06a5be6fc125424b371ce2708e7bf4491691e5764a","1acb250f255dd61c43d94ccc670d0f58f49ae3fa15b96623e5430da0ad6c62b2"],["b268f5ef9ad51e4d78de3a750c2dc89b1e626d43505867999932e5db33af3d80","5f310d4b3c99b9ebb19f77d41c1dee018cf0d34fd4191614003e945a1216e423"],["ff07f3118a9df035e9fad85eb6c7bfe42b02f01ca99ceea3bf7ffdba93c4750d","438136d603e858a3a5c440c38eccbaddc1d2942114e2eddd4740d098ced1f0d8"],["8d8b9855c7c052a34146fd20ffb658bea4b9f69e0d825ebec16e8c3ce2b526a1","cdb559eedc2d79f926baf44fb84ea4d44bcf50fee51d7ceb30e2e7f463036758"],["52db0b5384dfbf05bfa9d472d7ae26dfe4b851ceca91b1eba54263180da32b63","c3b997d050ee5d423ebaf66a6db9f57b3180c902875679de924b69d84a7b375"],["e62f9490d3d51da6395efd24e80919cc7d0f29c3f3fa48c6fff543becbd43352","6d89ad7ba4876b0b22c2ca280c682862f342c8591f1daf5170e07bfd9ccafa7d"],["7f30ea2476b399b4957509c88f77d0191afa2ff5cb7b14fd6d8e7d65aaab1193","ca5ef7d4b231c94c3b15389a5f6311e9daff7bb67b103e9880ef4bff637acaec"],["5098ff1e1d9f14fb46a210fada6c903fef0fb7b4a1dd1d9ac60a0361800b7a00","9731141d81fc8f8084d37c6e7542006b3ee1b40d60dfe5362a5b132fd17ddc0"],["32b78c7de9ee512a72895be6b9cbefa6e2f3c4ccce445c96b9f2c81e2778ad58","ee1849f513df71e32efc3896ee28260c73bb80547ae2275ba497237794c8753c"],["e2cb74fddc8e9fbcd076eef2a7c72b0ce37d50f08269dfc074b581550547a4f7","d3aa2ed71c9dd2247a62df062736eb0baddea9e36122d2be8641abcb005cc4a4"],["8438447566d4d7bedadc299496ab357426009a35f235cb141be0d99cd10ae3a8","c4e1020916980a4da5d01ac5e6ad330734ef0d7906631c4f2390426b2edd791f"],["4162d488b89402039b584c6fc6c308870587d9c46f660b878ab65c82c711d67e","67163e903236289f776f22c25fb8a3afc1732f2b84b4e95dbda47ae5a0852649"],["3fad3fa84caf0f34f0f89bfd2dcf54fc175d767aec3e50684f3ba4a4bf5f683d","cd1bc7cb6cc407bb2f0ca647c718a730cf71872e7d0d2a53fa20efcdfe61826"],["674f2600a3007a00568c1a7ce05d0816c1fb84bf1370798f1c69532faeb1a86b","299d21f9413f33b3edf43b257004580b70db57da0b182259e09eecc69e0d38a5"],["d32f4da54ade74abb81b815ad1fb3b263d82d6c692714bcff87d29bd5ee9f08f","f9429e738b8e53b968e99016c059707782e14f4535359d582fc416910b3eea87"],["30e4e670435385556e593657135845d36fbb6931f72b08cb1ed954f1e3ce3ff6","462f9bce619898638499350113bbc9b10a878d35da70740dc695a559eb88db7b"],["be2062003c51cc3004682904330e4dee7f3dcd10b01e580bf1971b04d4cad297","62188bc49d61e5428573d48a74e1c655b1c61090905682a0d5558ed72dccb9bc"],["93144423ace3451ed29e0fb9ac2af211cb6e84a601df5993c419859fff5df04a","7c10dfb164c3425f5c71a3f9d7992038f1065224f72bb9d1d902a6d13037b47c"],["b015f8044f5fcbdcf21ca26d6c34fb8197829205c7b7d2a7cb66418c157b112c","ab8c1e086d04e813744a655b2df8d5f83b3cdc6faa3088c1d3aea1454e3a1d5f"],["d5e9e1da649d97d89e4868117a465a3a4f8a18de57a140d36b3f2af341a21b52","4cb04437f391ed73111a13cc1d4dd0db1693465c2240480d8955e8592f27447a"],["d3ae41047dd7ca065dbf8ed77b992439983005cd72e16d6f996a5316d36966bb","bd1aeb21ad22ebb22a10f0303417c6d964f8cdd7df0aca614b10dc14d125ac46"],["463e2763d885f958fc66cdd22800f0a487197d0a82e377b49f80af87c897b065","bfefacdb0e5d0fd7df3a311a94de062b26b80c61fbc97508b79992671ef7ca7f"],["7985fdfd127c0567c6f53ec1bb63ec3158e597c40bfe747c83cddfc910641917","603c12daf3d9862ef2b25fe1de289aed24ed291e0ec6708703a5bd567f32ed03"],["74a1ad6b5f76e39db2dd249410eac7f99e74c59cb83d2d0ed5ff1543da7703e9","cc6157ef18c9c63cd6193d83631bbea0093e0968942e8c33d5737fd790e0db08"],["30682a50703375f602d416664ba19b7fc9bab42c72747463a71d0896b22f6da3","553e04f6b018b4fa6c8f39e7f311d3176290d0e0f19ca73f17714d9977a22ff8"],["9e2158f0d7c0d5f26c3791efefa79597654e7a2b2464f52b1ee6c1347769ef57","712fcdd1b9053f09003a3481fa7762e9ffd7c8ef35a38509e2fbf2629008373"],["176e26989a43c9cfeba4029c202538c28172e566e3c4fce7322857f3be327d66","ed8cc9d04b29eb877d270b4878dc43c19aefd31f4eee09ee7b47834c1fa4b1c3"],["75d46efea3771e6e68abb89a13ad747ecf1892393dfc4f1b7004788c50374da8","9852390a99507679fd0b86fd2b39a868d7efc22151346e1a3ca4726586a6bed8"],["809a20c67d64900ffb698c4c825f6d5f2310fb0451c869345b7319f645605721","9e994980d9917e22b76b061927fa04143d096ccc54963e6a5ebfa5f3f8e286c1"],["1b38903a43f7f114ed4500b4eac7083fdefece1cf29c63528d563446f972c180","4036edc931a60ae889353f77fd53de4a2708b26b6f5da72ad3394119daf408f9"]]
}}},{}],15:[function(a,b,c){"use strict";function d(a,b){for(var c=[],d=1<<b+1,e=a.clone();e.cmpn(1)>=0;){var f;if(e.isOdd()){var g=e.andln(d-1);f=g>(d>>1)-1?(d>>1)-g:g,e.isubn(f)}else f=0;c.push(f);for(var h=0!==e.cmpn(0)&&0===e.andln(d-1)?b+1:1,i=1;i<h;i++)c.push(0);e.iushrn(h)}return c}function e(a,b){var c=[[],[]];a=a.clone(),b=b.clone();for(var d=0,e=0;a.cmpn(-d)>0||b.cmpn(-e)>0;){var f=a.andln(3)+d&3,g=b.andln(3)+e&3;3===f&&(f=-1),3===g&&(g=-1);var h;if(0===(1&f))h=0;else{var i=a.andln(7)+d&7;h=3!==i&&5!==i||2!==g?f:-f}c[0].push(h);var j;if(0===(1&g))j=0;else{var i=b.andln(7)+e&7;j=3!==i&&5!==i||2!==f?g:-g}c[1].push(j),2*d===h+1&&(d=1-d),2*e===j+1&&(e=1-e),a.iushrn(1),b.iushrn(1)}return c}function f(a,b,c){var d="_"+b;a.prototype[b]=function(){return void 0!==this[d]?this[d]:this[d]=c.call(this)}}function g(a){return"string"==typeof a?i.toArray(a,"hex"):a}function h(a){return new j(a,"hex","le")}var i=c,j=a("bn.js"),k=a("minimalistic-assert"),l=a("minimalistic-crypto-utils");i.assert=k,i.toArray=l.toArray,i.zero2=l.zero2,i.toHex=l.toHex,i.encode=l.encode,i.getNAF=d,i.getJSF=e,i.cachedProperty=f,i.parseBytes=g,i.intFromLE=h},{"bn.js":16,"minimalistic-assert":28,"minimalistic-crypto-utils":29}],16:[function(a,b,c){!function(b,c){"use strict";function d(a,b){if(!a)throw new Error(b||"Assertion failed")}function e(a,b){a.super_=b;var c=function(){};c.prototype=b.prototype,a.prototype=new c,a.prototype.constructor=a}function f(a,b,c){return f.isBN(a)?a:(this.negative=0,this.words=null,this.length=0,this.red=null,void(null!==a&&("le"!==b&&"be"!==b||(c=b,b=10),this._init(a||0,b||10,c||"be"))))}function g(a,b,c){for(var d=0,e=Math.min(a.length,c),f=b;f<e;f++){var g=a.charCodeAt(f)-48;d<<=4,d|=g>=49&&g<=54?g-49+10:g>=17&&g<=22?g-17+10:15&g}return d}function h(a,b,c,d){for(var e=0,f=Math.min(a.length,c),g=b;g<f;g++){var h=a.charCodeAt(g)-48;e*=d,e+=h>=49?h-49+10:h>=17?h-17+10:h}return e}function i(a){for(var b=new Array(a.bitLength()),c=0;c<b.length;c++){var d=c/26|0,e=c%26;b[c]=(a.words[d]&1<<e)>>>e}return b}function j(a,b,c){c.negative=b.negative^a.negative;var d=a.length+b.length|0;c.length=d,d=d-1|0;var e=0|a.words[0],f=0|b.words[0],g=e*f,h=67108863&g,i=g/67108864|0;c.words[0]=h;for(var j=1;j<d;j++){for(var k=i>>>26,l=67108863&i,m=Math.min(j,b.length-1),n=Math.max(0,j-a.length+1);n<=m;n++){var o=j-n|0;e=0|a.words[o],f=0|b.words[n],g=e*f+l,k+=g/67108864|0,l=67108863&g}c.words[j]=0|l,i=0|k}return 0!==i?c.words[j]=0|i:c.length--,c.strip()}function k(a,b,c){c.negative=b.negative^a.negative,c.length=a.length+b.length;for(var d=0,e=0,f=0;f<c.length-1;f++){var g=e;e=0;for(var h=67108863&d,i=Math.min(f,b.length-1),j=Math.max(0,f-a.length+1);j<=i;j++){var k=f-j,l=0|a.words[k],m=0|b.words[j],n=l*m,o=67108863&n;g=g+(n/67108864|0)|0,o=o+h|0,h=67108863&o,g=g+(o>>>26)|0,e+=g>>>26,g&=67108863}c.words[f]=h,d=g,g=e}return 0!==d?c.words[f]=d:c.length--,c.strip()}function l(a,b,c){var d=new m;return d.mulp(a,b,c)}function m(a,b){this.x=a,this.y=b}function n(a,b){this.name=a,this.p=new f(b,16),this.n=this.p.bitLength(),this.k=new f(1).iushln(this.n).isub(this.p),this.tmp=this._tmp()}function o(){n.call(this,"k256","ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f")}function p(){n.call(this,"p224","ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001")}function q(){n.call(this,"p192","ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff")}function r(){n.call(this,"25519","7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed")}function s(a){if("string"==typeof a){var b=f._prime(a);this.m=b.p,this.prime=b}else d(a.gtn(1),"modulus must be greater than 1"),this.m=a,this.prime=null}function t(a){s.call(this,a),this.shift=this.m.bitLength(),this.shift%26!==0&&(this.shift+=26-this.shift%26),this.r=new f(1).iushln(this.shift),this.r2=this.imod(this.r.sqr()),this.rinv=this.r._invmp(this.m),this.minv=this.rinv.mul(this.r).isubn(1).div(this.m),this.minv=this.minv.umod(this.r),this.minv=this.r.sub(this.minv)}"object"==typeof b?b.exports=f:c.BN=f,f.BN=f,f.wordSize=26;var u;try{u=a("buffer").Buffer}catch(v){}f.isBN=function(a){return a instanceof f||null!==a&&"object"==typeof a&&a.constructor.wordSize===f.wordSize&&Array.isArray(a.words)},f.max=function(a,b){return a.cmp(b)>0?a:b},f.min=function(a,b){return a.cmp(b)<0?a:b},f.prototype._init=function(a,b,c){if("number"==typeof a)return this._initNumber(a,b,c);if("object"==typeof a)return this._initArray(a,b,c);"hex"===b&&(b=16),d(b===(0|b)&&b>=2&&b<=36),a=a.toString().replace(/\s+/g,"");var e=0;"-"===a[0]&&e++,16===b?this._parseHex(a,e):this._parseBase(a,b,e),"-"===a[0]&&(this.negative=1),this.strip(),"le"===c&&this._initArray(this.toArray(),b,c)},f.prototype._initNumber=function(a,b,c){a<0&&(this.negative=1,a=-a),a<67108864?(this.words=[67108863&a],this.length=1):a<4503599627370496?(this.words=[67108863&a,a/67108864&67108863],this.length=2):(d(a<9007199254740992),this.words=[67108863&a,a/67108864&67108863,1],this.length=3),"le"===c&&this._initArray(this.toArray(),b,c)},f.prototype._initArray=function(a,b,c){if(d("number"==typeof a.length),a.length<=0)return this.words=[0],this.length=1,this;this.length=Math.ceil(a.length/3),this.words=new Array(this.length);for(var e=0;e<this.length;e++)this.words[e]=0;var f,g,h=0;if("be"===c)for(e=a.length-1,f=0;e>=0;e-=3)g=a[e]|a[e-1]<<8|a[e-2]<<16,this.words[f]|=g<<h&67108863,this.words[f+1]=g>>>26-h&67108863,h+=24,h>=26&&(h-=26,f++);else if("le"===c)for(e=0,f=0;e<a.length;e+=3)g=a[e]|a[e+1]<<8|a[e+2]<<16,this.words[f]|=g<<h&67108863,this.words[f+1]=g>>>26-h&67108863,h+=24,h>=26&&(h-=26,f++);return this.strip()},f.prototype._parseHex=function(a,b){this.length=Math.ceil((a.length-b)/6),this.words=new Array(this.length);for(var c=0;c<this.length;c++)this.words[c]=0;var d,e,f=0;for(c=a.length-6,d=0;c>=b;c-=6)e=g(a,c,c+6),this.words[d]|=e<<f&67108863,this.words[d+1]|=e>>>26-f&4194303,f+=24,f>=26&&(f-=26,d++);c+6!==b&&(e=g(a,b,c+6),this.words[d]|=e<<f&67108863,this.words[d+1]|=e>>>26-f&4194303),this.strip()},f.prototype._parseBase=function(a,b,c){this.words=[0],this.length=1;for(var d=0,e=1;e<=67108863;e*=b)d++;d--,e=e/b|0;for(var f=a.length-c,g=f%d,i=Math.min(f,f-g)+c,j=0,k=c;k<i;k+=d)j=h(a,k,k+d,b),this.imuln(e),this.words[0]+j<67108864?this.words[0]+=j:this._iaddn(j);if(0!==g){var l=1;for(j=h(a,k,a.length,b),k=0;k<g;k++)l*=b;this.imuln(l),this.words[0]+j<67108864?this.words[0]+=j:this._iaddn(j)}},f.prototype.copy=function(a){a.words=new Array(this.length);for(var b=0;b<this.length;b++)a.words[b]=this.words[b];a.length=this.length,a.negative=this.negative,a.red=this.red},f.prototype.clone=function(){var a=new f(null);return this.copy(a),a},f.prototype._expand=function(a){for(;this.length<a;)this.words[this.length++]=0;return this},f.prototype.strip=function(){for(;this.length>1&&0===this.words[this.length-1];)this.length--;return this._normSign()},f.prototype._normSign=function(){return 1===this.length&&0===this.words[0]&&(this.negative=0),this},f.prototype.inspect=function(){return(this.red?"<BN-R: ":"<BN: ")+this.toString(16)+">"};var w=["","0","00","000","0000","00000","000000","0000000","00000000","000000000","0000000000","00000000000","000000000000","0000000000000","00000000000000","000000000000000","0000000000000000","00000000000000000","000000000000000000","0000000000000000000","00000000000000000000","000000000000000000000","0000000000000000000000","00000000000000000000000","000000000000000000000000","0000000000000000000000000"],x=[0,0,25,16,12,11,10,9,8,8,7,7,7,7,6,6,6,6,6,6,6,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5],y=[0,0,33554432,43046721,16777216,48828125,60466176,40353607,16777216,43046721,1e7,19487171,35831808,62748517,7529536,11390625,16777216,24137569,34012224,47045881,64e6,4084101,5153632,6436343,7962624,9765625,11881376,14348907,17210368,20511149,243e5,28629151,33554432,39135393,45435424,52521875,60466176];f.prototype.toString=function(a,b){a=a||10,b=0|b||1;var c;if(16===a||"hex"===a){c="";for(var e=0,f=0,g=0;g<this.length;g++){var h=this.words[g],i=(16777215&(h<<e|f)).toString(16);f=h>>>24-e&16777215,c=0!==f||g!==this.length-1?w[6-i.length]+i+c:i+c,e+=2,e>=26&&(e-=26,g--)}for(0!==f&&(c=f.toString(16)+c);c.length%b!==0;)c="0"+c;return 0!==this.negative&&(c="-"+c),c}if(a===(0|a)&&a>=2&&a<=36){var j=x[a],k=y[a];c="";var l=this.clone();for(l.negative=0;!l.isZero();){var m=l.modn(k).toString(a);l=l.idivn(k),c=l.isZero()?m+c:w[j-m.length]+m+c}for(this.isZero()&&(c="0"+c);c.length%b!==0;)c="0"+c;return 0!==this.negative&&(c="-"+c),c}d(!1,"Base should be between 2 and 36")},f.prototype.toNumber=function(){var a=this.words[0];return 2===this.length?a+=67108864*this.words[1]:3===this.length&&1===this.words[2]?a+=4503599627370496+67108864*this.words[1]:this.length>2&&d(!1,"Number can only safely store up to 53 bits"),0!==this.negative?-a:a},f.prototype.toJSON=function(){return this.toString(16)},f.prototype.toBuffer=function(a,b){return d("undefined"!=typeof u),this.toArrayLike(u,a,b)},f.prototype.toArray=function(a,b){return this.toArrayLike(Array,a,b)},f.prototype.toArrayLike=function(a,b,c){var e=this.byteLength(),f=c||Math.max(1,e);d(e<=f,"byte array longer than desired length"),d(f>0,"Requested array length <= 0"),this.strip();var g,h,i="le"===b,j=new a(f),k=this.clone();if(i){for(h=0;!k.isZero();h++)g=k.andln(255),k.iushrn(8),j[h]=g;for(;h<f;h++)j[h]=0}else{for(h=0;h<f-e;h++)j[h]=0;for(h=0;!k.isZero();h++)g=k.andln(255),k.iushrn(8),j[f-h-1]=g}return j},Math.clz32?f.prototype._countBits=function(a){return 32-Math.clz32(a)}:f.prototype._countBits=function(a){var b=a,c=0;return b>=4096&&(c+=13,b>>>=13),b>=64&&(c+=7,b>>>=7),b>=8&&(c+=4,b>>>=4),b>=2&&(c+=2,b>>>=2),c+b},f.prototype._zeroBits=function(a){if(0===a)return 26;var b=a,c=0;return 0===(8191&b)&&(c+=13,b>>>=13),0===(127&b)&&(c+=7,b>>>=7),0===(15&b)&&(c+=4,b>>>=4),0===(3&b)&&(c+=2,b>>>=2),0===(1&b)&&c++,c},f.prototype.bitLength=function(){var a=this.words[this.length-1],b=this._countBits(a);return 26*(this.length-1)+b},f.prototype.zeroBits=function(){if(this.isZero())return 0;for(var a=0,b=0;b<this.length;b++){var c=this._zeroBits(this.words[b]);if(a+=c,26!==c)break}return a},f.prototype.byteLength=function(){return Math.ceil(this.bitLength()/8)},f.prototype.toTwos=function(a){return 0!==this.negative?this.abs().inotn(a).iaddn(1):this.clone()},f.prototype.fromTwos=function(a){return this.testn(a-1)?this.notn(a).iaddn(1).ineg():this.clone()},f.prototype.isNeg=function(){return 0!==this.negative},f.prototype.neg=function(){return this.clone().ineg()},f.prototype.ineg=function(){return this.isZero()||(this.negative^=1),this},f.prototype.iuor=function(a){for(;this.length<a.length;)this.words[this.length++]=0;for(var b=0;b<a.length;b++)this.words[b]=this.words[b]|a.words[b];return this.strip()},f.prototype.ior=function(a){return d(0===(this.negative|a.negative)),this.iuor(a)},f.prototype.or=function(a){return this.length>a.length?this.clone().ior(a):a.clone().ior(this)},f.prototype.uor=function(a){return this.length>a.length?this.clone().iuor(a):a.clone().iuor(this)},f.prototype.iuand=function(a){var b;b=this.length>a.length?a:this;for(var c=0;c<b.length;c++)this.words[c]=this.words[c]&a.words[c];return this.length=b.length,this.strip()},f.prototype.iand=function(a){return d(0===(this.negative|a.negative)),this.iuand(a)},f.prototype.and=function(a){return this.length>a.length?this.clone().iand(a):a.clone().iand(this)},f.prototype.uand=function(a){return this.length>a.length?this.clone().iuand(a):a.clone().iuand(this)},f.prototype.iuxor=function(a){var b,c;this.length>a.length?(b=this,c=a):(b=a,c=this);for(var d=0;d<c.length;d++)this.words[d]=b.words[d]^c.words[d];if(this!==b)for(;d<b.length;d++)this.words[d]=b.words[d];return this.length=b.length,this.strip()},f.prototype.ixor=function(a){return d(0===(this.negative|a.negative)),this.iuxor(a)},f.prototype.xor=function(a){return this.length>a.length?this.clone().ixor(a):a.clone().ixor(this)},f.prototype.uxor=function(a){return this.length>a.length?this.clone().iuxor(a):a.clone().iuxor(this)},f.prototype.inotn=function(a){d("number"==typeof a&&a>=0);var b=0|Math.ceil(a/26),c=a%26;this._expand(b),c>0&&b--;for(var e=0;e<b;e++)this.words[e]=67108863&~this.words[e];return c>0&&(this.words[e]=~this.words[e]&67108863>>26-c),this.strip()},f.prototype.notn=function(a){return this.clone().inotn(a)},f.prototype.setn=function(a,b){d("number"==typeof a&&a>=0);var c=a/26|0,e=a%26;return this._expand(c+1),b?this.words[c]=this.words[c]|1<<e:this.words[c]=this.words[c]&~(1<<e),this.strip()},f.prototype.iadd=function(a){var b;if(0!==this.negative&&0===a.negative)return this.negative=0,b=this.isub(a),this.negative^=1,this._normSign();if(0===this.negative&&0!==a.negative)return a.negative=0,b=this.isub(a),a.negative=1,b._normSign();var c,d;this.length>a.length?(c=this,d=a):(c=a,d=this);for(var e=0,f=0;f<d.length;f++)b=(0|c.words[f])+(0|d.words[f])+e,this.words[f]=67108863&b,e=b>>>26;for(;0!==e&&f<c.length;f++)b=(0|c.words[f])+e,this.words[f]=67108863&b,e=b>>>26;if(this.length=c.length,0!==e)this.words[this.length]=e,this.length++;else if(c!==this)for(;f<c.length;f++)this.words[f]=c.words[f];return this},f.prototype.add=function(a){var b;return 0!==a.negative&&0===this.negative?(a.negative=0,b=this.sub(a),a.negative^=1,b):0===a.negative&&0!==this.negative?(this.negative=0,b=a.sub(this),this.negative=1,b):this.length>a.length?this.clone().iadd(a):a.clone().iadd(this)},f.prototype.isub=function(a){if(0!==a.negative){a.negative=0;var b=this.iadd(a);return a.negative=1,b._normSign()}if(0!==this.negative)return this.negative=0,this.iadd(a),this.negative=1,this._normSign();var c=this.cmp(a);if(0===c)return this.negative=0,this.length=1,this.words[0]=0,this;var d,e;c>0?(d=this,e=a):(d=a,e=this);for(var f=0,g=0;g<e.length;g++)b=(0|d.words[g])-(0|e.words[g])+f,f=b>>26,this.words[g]=67108863&b;for(;0!==f&&g<d.length;g++)b=(0|d.words[g])+f,f=b>>26,this.words[g]=67108863&b;if(0===f&&g<d.length&&d!==this)for(;g<d.length;g++)this.words[g]=d.words[g];return this.length=Math.max(this.length,g),d!==this&&(this.negative=1),this.strip()},f.prototype.sub=function(a){return this.clone().isub(a)};var z=function(a,b,c){var d,e,f,g=a.words,h=b.words,i=c.words,j=0,k=0|g[0],l=8191&k,m=k>>>13,n=0|g[1],o=8191&n,p=n>>>13,q=0|g[2],r=8191&q,s=q>>>13,t=0|g[3],u=8191&t,v=t>>>13,w=0|g[4],x=8191&w,y=w>>>13,z=0|g[5],A=8191&z,B=z>>>13,C=0|g[6],D=8191&C,E=C>>>13,F=0|g[7],G=8191&F,H=F>>>13,I=0|g[8],J=8191&I,K=I>>>13,L=0|g[9],M=8191&L,N=L>>>13,O=0|h[0],P=8191&O,Q=O>>>13,R=0|h[1],S=8191&R,T=R>>>13,U=0|h[2],V=8191&U,W=U>>>13,X=0|h[3],Y=8191&X,Z=X>>>13,$=0|h[4],_=8191&$,aa=$>>>13,ba=0|h[5],ca=8191&ba,da=ba>>>13,ea=0|h[6],fa=8191&ea,ga=ea>>>13,ha=0|h[7],ia=8191&ha,ja=ha>>>13,ka=0|h[8],la=8191&ka,ma=ka>>>13,na=0|h[9],oa=8191&na,pa=na>>>13;c.negative=a.negative^b.negative,c.length=19,d=Math.imul(l,P),e=Math.imul(l,Q),e=e+Math.imul(m,P)|0,f=Math.imul(m,Q);var qa=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(qa>>>26)|0,qa&=67108863,d=Math.imul(o,P),e=Math.imul(o,Q),e=e+Math.imul(p,P)|0,f=Math.imul(p,Q),d=d+Math.imul(l,S)|0,e=e+Math.imul(l,T)|0,e=e+Math.imul(m,S)|0,f=f+Math.imul(m,T)|0;var ra=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(ra>>>26)|0,ra&=67108863,d=Math.imul(r,P),e=Math.imul(r,Q),e=e+Math.imul(s,P)|0,f=Math.imul(s,Q),d=d+Math.imul(o,S)|0,e=e+Math.imul(o,T)|0,e=e+Math.imul(p,S)|0,f=f+Math.imul(p,T)|0,d=d+Math.imul(l,V)|0,e=e+Math.imul(l,W)|0,e=e+Math.imul(m,V)|0,f=f+Math.imul(m,W)|0;var sa=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(sa>>>26)|0,sa&=67108863,d=Math.imul(u,P),e=Math.imul(u,Q),e=e+Math.imul(v,P)|0,f=Math.imul(v,Q),d=d+Math.imul(r,S)|0,e=e+Math.imul(r,T)|0,e=e+Math.imul(s,S)|0,f=f+Math.imul(s,T)|0,d=d+Math.imul(o,V)|0,e=e+Math.imul(o,W)|0,e=e+Math.imul(p,V)|0,f=f+Math.imul(p,W)|0,d=d+Math.imul(l,Y)|0,e=e+Math.imul(l,Z)|0,e=e+Math.imul(m,Y)|0,f=f+Math.imul(m,Z)|0;var ta=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(ta>>>26)|0,ta&=67108863,d=Math.imul(x,P),e=Math.imul(x,Q),e=e+Math.imul(y,P)|0,f=Math.imul(y,Q),d=d+Math.imul(u,S)|0,e=e+Math.imul(u,T)|0,e=e+Math.imul(v,S)|0,f=f+Math.imul(v,T)|0,d=d+Math.imul(r,V)|0,e=e+Math.imul(r,W)|0,e=e+Math.imul(s,V)|0,f=f+Math.imul(s,W)|0,d=d+Math.imul(o,Y)|0,e=e+Math.imul(o,Z)|0,e=e+Math.imul(p,Y)|0,f=f+Math.imul(p,Z)|0,d=d+Math.imul(l,_)|0,e=e+Math.imul(l,aa)|0,e=e+Math.imul(m,_)|0,f=f+Math.imul(m,aa)|0;var ua=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(ua>>>26)|0,ua&=67108863,d=Math.imul(A,P),e=Math.imul(A,Q),e=e+Math.imul(B,P)|0,f=Math.imul(B,Q),d=d+Math.imul(x,S)|0,e=e+Math.imul(x,T)|0,e=e+Math.imul(y,S)|0,f=f+Math.imul(y,T)|0,d=d+Math.imul(u,V)|0,e=e+Math.imul(u,W)|0,e=e+Math.imul(v,V)|0,f=f+Math.imul(v,W)|0,d=d+Math.imul(r,Y)|0,e=e+Math.imul(r,Z)|0,e=e+Math.imul(s,Y)|0,f=f+Math.imul(s,Z)|0,d=d+Math.imul(o,_)|0,e=e+Math.imul(o,aa)|0,e=e+Math.imul(p,_)|0,f=f+Math.imul(p,aa)|0,d=d+Math.imul(l,ca)|0,e=e+Math.imul(l,da)|0,e=e+Math.imul(m,ca)|0,f=f+Math.imul(m,da)|0;var va=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(va>>>26)|0,va&=67108863,d=Math.imul(D,P),e=Math.imul(D,Q),e=e+Math.imul(E,P)|0,f=Math.imul(E,Q),d=d+Math.imul(A,S)|0,e=e+Math.imul(A,T)|0,e=e+Math.imul(B,S)|0,f=f+Math.imul(B,T)|0,d=d+Math.imul(x,V)|0,e=e+Math.imul(x,W)|0,e=e+Math.imul(y,V)|0,f=f+Math.imul(y,W)|0,d=d+Math.imul(u,Y)|0,e=e+Math.imul(u,Z)|0,e=e+Math.imul(v,Y)|0,f=f+Math.imul(v,Z)|0,d=d+Math.imul(r,_)|0,e=e+Math.imul(r,aa)|0,e=e+Math.imul(s,_)|0,f=f+Math.imul(s,aa)|0,d=d+Math.imul(o,ca)|0,e=e+Math.imul(o,da)|0,e=e+Math.imul(p,ca)|0,f=f+Math.imul(p,da)|0,d=d+Math.imul(l,fa)|0,e=e+Math.imul(l,ga)|0,e=e+Math.imul(m,fa)|0,f=f+Math.imul(m,ga)|0;var wa=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(wa>>>26)|0,wa&=67108863,d=Math.imul(G,P),e=Math.imul(G,Q),e=e+Math.imul(H,P)|0,f=Math.imul(H,Q),d=d+Math.imul(D,S)|0,e=e+Math.imul(D,T)|0,e=e+Math.imul(E,S)|0,f=f+Math.imul(E,T)|0,d=d+Math.imul(A,V)|0,e=e+Math.imul(A,W)|0,e=e+Math.imul(B,V)|0,f=f+Math.imul(B,W)|0,d=d+Math.imul(x,Y)|0,e=e+Math.imul(x,Z)|0,e=e+Math.imul(y,Y)|0,f=f+Math.imul(y,Z)|0,d=d+Math.imul(u,_)|0,e=e+Math.imul(u,aa)|0,e=e+Math.imul(v,_)|0,f=f+Math.imul(v,aa)|0,d=d+Math.imul(r,ca)|0,e=e+Math.imul(r,da)|0,e=e+Math.imul(s,ca)|0,f=f+Math.imul(s,da)|0,d=d+Math.imul(o,fa)|0,e=e+Math.imul(o,ga)|0,e=e+Math.imul(p,fa)|0,f=f+Math.imul(p,ga)|0,d=d+Math.imul(l,ia)|0,e=e+Math.imul(l,ja)|0,e=e+Math.imul(m,ia)|0,f=f+Math.imul(m,ja)|0;var xa=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(xa>>>26)|0,xa&=67108863,d=Math.imul(J,P),e=Math.imul(J,Q),e=e+Math.imul(K,P)|0,f=Math.imul(K,Q),d=d+Math.imul(G,S)|0,e=e+Math.imul(G,T)|0,e=e+Math.imul(H,S)|0,f=f+Math.imul(H,T)|0,d=d+Math.imul(D,V)|0,e=e+Math.imul(D,W)|0,e=e+Math.imul(E,V)|0,f=f+Math.imul(E,W)|0,d=d+Math.imul(A,Y)|0,e=e+Math.imul(A,Z)|0,e=e+Math.imul(B,Y)|0,f=f+Math.imul(B,Z)|0,d=d+Math.imul(x,_)|0,e=e+Math.imul(x,aa)|0,e=e+Math.imul(y,_)|0,f=f+Math.imul(y,aa)|0,d=d+Math.imul(u,ca)|0,e=e+Math.imul(u,da)|0,e=e+Math.imul(v,ca)|0,f=f+Math.imul(v,da)|0,d=d+Math.imul(r,fa)|0,e=e+Math.imul(r,ga)|0,e=e+Math.imul(s,fa)|0,f=f+Math.imul(s,ga)|0,d=d+Math.imul(o,ia)|0,e=e+Math.imul(o,ja)|0,e=e+Math.imul(p,ia)|0,f=f+Math.imul(p,ja)|0,d=d+Math.imul(l,la)|0,e=e+Math.imul(l,ma)|0,e=e+Math.imul(m,la)|0,f=f+Math.imul(m,ma)|0;var ya=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(ya>>>26)|0,ya&=67108863,d=Math.imul(M,P),e=Math.imul(M,Q),e=e+Math.imul(N,P)|0,f=Math.imul(N,Q),d=d+Math.imul(J,S)|0,e=e+Math.imul(J,T)|0,e=e+Math.imul(K,S)|0,f=f+Math.imul(K,T)|0,d=d+Math.imul(G,V)|0,e=e+Math.imul(G,W)|0,e=e+Math.imul(H,V)|0,f=f+Math.imul(H,W)|0,d=d+Math.imul(D,Y)|0,e=e+Math.imul(D,Z)|0,e=e+Math.imul(E,Y)|0,f=f+Math.imul(E,Z)|0,d=d+Math.imul(A,_)|0,e=e+Math.imul(A,aa)|0,e=e+Math.imul(B,_)|0,f=f+Math.imul(B,aa)|0,d=d+Math.imul(x,ca)|0,e=e+Math.imul(x,da)|0,e=e+Math.imul(y,ca)|0,f=f+Math.imul(y,da)|0,d=d+Math.imul(u,fa)|0,e=e+Math.imul(u,ga)|0,e=e+Math.imul(v,fa)|0,f=f+Math.imul(v,ga)|0,d=d+Math.imul(r,ia)|0,e=e+Math.imul(r,ja)|0,e=e+Math.imul(s,ia)|0,f=f+Math.imul(s,ja)|0,d=d+Math.imul(o,la)|0,e=e+Math.imul(o,ma)|0,e=e+Math.imul(p,la)|0,f=f+Math.imul(p,ma)|0,d=d+Math.imul(l,oa)|0,e=e+Math.imul(l,pa)|0,e=e+Math.imul(m,oa)|0,f=f+Math.imul(m,pa)|0;var za=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(za>>>26)|0,za&=67108863,d=Math.imul(M,S),e=Math.imul(M,T),e=e+Math.imul(N,S)|0,f=Math.imul(N,T),d=d+Math.imul(J,V)|0,e=e+Math.imul(J,W)|0,e=e+Math.imul(K,V)|0,f=f+Math.imul(K,W)|0,d=d+Math.imul(G,Y)|0,e=e+Math.imul(G,Z)|0,e=e+Math.imul(H,Y)|0,f=f+Math.imul(H,Z)|0,d=d+Math.imul(D,_)|0,e=e+Math.imul(D,aa)|0,e=e+Math.imul(E,_)|0,f=f+Math.imul(E,aa)|0,d=d+Math.imul(A,ca)|0,e=e+Math.imul(A,da)|0,e=e+Math.imul(B,ca)|0,f=f+Math.imul(B,da)|0,d=d+Math.imul(x,fa)|0,e=e+Math.imul(x,ga)|0,e=e+Math.imul(y,fa)|0,f=f+Math.imul(y,ga)|0,d=d+Math.imul(u,ia)|0,e=e+Math.imul(u,ja)|0,e=e+Math.imul(v,ia)|0,f=f+Math.imul(v,ja)|0,d=d+Math.imul(r,la)|0,e=e+Math.imul(r,ma)|0,e=e+Math.imul(s,la)|0,f=f+Math.imul(s,ma)|0,d=d+Math.imul(o,oa)|0,e=e+Math.imul(o,pa)|0,e=e+Math.imul(p,oa)|0,f=f+Math.imul(p,pa)|0;var Aa=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(Aa>>>26)|0,Aa&=67108863,d=Math.imul(M,V),e=Math.imul(M,W),e=e+Math.imul(N,V)|0,f=Math.imul(N,W),d=d+Math.imul(J,Y)|0,e=e+Math.imul(J,Z)|0,e=e+Math.imul(K,Y)|0,f=f+Math.imul(K,Z)|0,d=d+Math.imul(G,_)|0,e=e+Math.imul(G,aa)|0,e=e+Math.imul(H,_)|0,f=f+Math.imul(H,aa)|0,d=d+Math.imul(D,ca)|0,e=e+Math.imul(D,da)|0,e=e+Math.imul(E,ca)|0,f=f+Math.imul(E,da)|0,d=d+Math.imul(A,fa)|0,e=e+Math.imul(A,ga)|0,e=e+Math.imul(B,fa)|0,f=f+Math.imul(B,ga)|0,d=d+Math.imul(x,ia)|0,e=e+Math.imul(x,ja)|0,e=e+Math.imul(y,ia)|0,f=f+Math.imul(y,ja)|0,d=d+Math.imul(u,la)|0,e=e+Math.imul(u,ma)|0,e=e+Math.imul(v,la)|0,f=f+Math.imul(v,ma)|0,d=d+Math.imul(r,oa)|0,e=e+Math.imul(r,pa)|0,e=e+Math.imul(s,oa)|0,f=f+Math.imul(s,pa)|0;var Ba=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(Ba>>>26)|0,Ba&=67108863,d=Math.imul(M,Y),e=Math.imul(M,Z),e=e+Math.imul(N,Y)|0,f=Math.imul(N,Z),d=d+Math.imul(J,_)|0,e=e+Math.imul(J,aa)|0,e=e+Math.imul(K,_)|0,f=f+Math.imul(K,aa)|0,d=d+Math.imul(G,ca)|0,e=e+Math.imul(G,da)|0,e=e+Math.imul(H,ca)|0,f=f+Math.imul(H,da)|0,d=d+Math.imul(D,fa)|0,e=e+Math.imul(D,ga)|0,e=e+Math.imul(E,fa)|0,f=f+Math.imul(E,ga)|0,d=d+Math.imul(A,ia)|0,e=e+Math.imul(A,ja)|0,e=e+Math.imul(B,ia)|0,f=f+Math.imul(B,ja)|0,d=d+Math.imul(x,la)|0,e=e+Math.imul(x,ma)|0,e=e+Math.imul(y,la)|0,f=f+Math.imul(y,ma)|0,d=d+Math.imul(u,oa)|0,e=e+Math.imul(u,pa)|0,e=e+Math.imul(v,oa)|0,f=f+Math.imul(v,pa)|0;var Ca=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(Ca>>>26)|0,Ca&=67108863,d=Math.imul(M,_),e=Math.imul(M,aa),e=e+Math.imul(N,_)|0,f=Math.imul(N,aa),d=d+Math.imul(J,ca)|0,e=e+Math.imul(J,da)|0,e=e+Math.imul(K,ca)|0,f=f+Math.imul(K,da)|0,d=d+Math.imul(G,fa)|0,e=e+Math.imul(G,ga)|0,e=e+Math.imul(H,fa)|0,f=f+Math.imul(H,ga)|0,d=d+Math.imul(D,ia)|0,e=e+Math.imul(D,ja)|0,e=e+Math.imul(E,ia)|0,f=f+Math.imul(E,ja)|0,d=d+Math.imul(A,la)|0,e=e+Math.imul(A,ma)|0,e=e+Math.imul(B,la)|0,f=f+Math.imul(B,ma)|0,d=d+Math.imul(x,oa)|0,e=e+Math.imul(x,pa)|0,e=e+Math.imul(y,oa)|0,f=f+Math.imul(y,pa)|0;var Da=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(Da>>>26)|0,Da&=67108863,d=Math.imul(M,ca),e=Math.imul(M,da),e=e+Math.imul(N,ca)|0,f=Math.imul(N,da),d=d+Math.imul(J,fa)|0,e=e+Math.imul(J,ga)|0,e=e+Math.imul(K,fa)|0,f=f+Math.imul(K,ga)|0,d=d+Math.imul(G,ia)|0,e=e+Math.imul(G,ja)|0,e=e+Math.imul(H,ia)|0,f=f+Math.imul(H,ja)|0,d=d+Math.imul(D,la)|0,e=e+Math.imul(D,ma)|0,e=e+Math.imul(E,la)|0,f=f+Math.imul(E,ma)|0,d=d+Math.imul(A,oa)|0,e=e+Math.imul(A,pa)|0,e=e+Math.imul(B,oa)|0,f=f+Math.imul(B,pa)|0;var Ea=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(Ea>>>26)|0,Ea&=67108863,d=Math.imul(M,fa),e=Math.imul(M,ga),e=e+Math.imul(N,fa)|0,f=Math.imul(N,ga),d=d+Math.imul(J,ia)|0,e=e+Math.imul(J,ja)|0,e=e+Math.imul(K,ia)|0,f=f+Math.imul(K,ja)|0,d=d+Math.imul(G,la)|0,e=e+Math.imul(G,ma)|0,e=e+Math.imul(H,la)|0,f=f+Math.imul(H,ma)|0,d=d+Math.imul(D,oa)|0,e=e+Math.imul(D,pa)|0,e=e+Math.imul(E,oa)|0,f=f+Math.imul(E,pa)|0;var Fa=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(Fa>>>26)|0,Fa&=67108863,d=Math.imul(M,ia),e=Math.imul(M,ja),e=e+Math.imul(N,ia)|0,f=Math.imul(N,ja),d=d+Math.imul(J,la)|0,e=e+Math.imul(J,ma)|0,e=e+Math.imul(K,la)|0,f=f+Math.imul(K,ma)|0,d=d+Math.imul(G,oa)|0,e=e+Math.imul(G,pa)|0,e=e+Math.imul(H,oa)|0,f=f+Math.imul(H,pa)|0;var Ga=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(Ga>>>26)|0,Ga&=67108863,d=Math.imul(M,la),e=Math.imul(M,ma),e=e+Math.imul(N,la)|0,f=Math.imul(N,ma),d=d+Math.imul(J,oa)|0,e=e+Math.imul(J,pa)|0,e=e+Math.imul(K,oa)|0,f=f+Math.imul(K,pa)|0;var Ha=(j+d|0)+((8191&e)<<13)|0;j=(f+(e>>>13)|0)+(Ha>>>26)|0,Ha&=67108863,d=Math.imul(M,oa),e=Math.imul(M,pa),e=e+Math.imul(N,oa)|0,f=Math.imul(N,pa);var Ia=(j+d|0)+((8191&e)<<13)|0;return j=(f+(e>>>13)|0)+(Ia>>>26)|0,Ia&=67108863,i[0]=qa,i[1]=ra,i[2]=sa,i[3]=ta,i[4]=ua,i[5]=va,i[6]=wa,i[7]=xa,i[8]=ya,i[9]=za,i[10]=Aa,i[11]=Ba,i[12]=Ca,i[13]=Da,i[14]=Ea,i[15]=Fa,i[16]=Ga,i[17]=Ha,i[18]=Ia,0!==j&&(i[19]=j,c.length++),c};Math.imul||(z=j),f.prototype.mulTo=function(a,b){var c,d=this.length+a.length;return c=10===this.length&&10===a.length?z(this,a,b):d<63?j(this,a,b):d<1024?k(this,a,b):l(this,a,b)},m.prototype.makeRBT=function(a){for(var b=new Array(a),c=f.prototype._countBits(a)-1,d=0;d<a;d++)b[d]=this.revBin(d,c,a);return b},m.prototype.revBin=function(a,b,c){if(0===a||a===c-1)return a;for(var d=0,e=0;e<b;e++)d|=(1&a)<<b-e-1,a>>=1;return d},m.prototype.permute=function(a,b,c,d,e,f){for(var g=0;g<f;g++)d[g]=b[a[g]],e[g]=c[a[g]]},m.prototype.transform=function(a,b,c,d,e,f){this.permute(f,a,b,c,d,e);for(var g=1;g<e;g<<=1)for(var h=g<<1,i=Math.cos(2*Math.PI/h),j=Math.sin(2*Math.PI/h),k=0;k<e;k+=h)for(var l=i,m=j,n=0;n<g;n++){var o=c[k+n],p=d[k+n],q=c[k+n+g],r=d[k+n+g],s=l*q-m*r;r=l*r+m*q,q=s,c[k+n]=o+q,d[k+n]=p+r,c[k+n+g]=o-q,d[k+n+g]=p-r,n!==h&&(s=i*l-j*m,m=i*m+j*l,l=s)}},m.prototype.guessLen13b=function(a,b){var c=1|Math.max(b,a),d=1&c,e=0;for(c=c/2|0;c;c>>>=1)e++;return 1<<e+1+d},m.prototype.conjugate=function(a,b,c){if(!(c<=1))for(var d=0;d<c/2;d++){var e=a[d];a[d]=a[c-d-1],a[c-d-1]=e,e=b[d],b[d]=-b[c-d-1],b[c-d-1]=-e}},m.prototype.normalize13b=function(a,b){for(var c=0,d=0;d<b/2;d++){var e=8192*Math.round(a[2*d+1]/b)+Math.round(a[2*d]/b)+c;a[d]=67108863&e,c=e<67108864?0:e/67108864|0}return a},m.prototype.convert13b=function(a,b,c,e){for(var f=0,g=0;g<b;g++)f+=0|a[g],c[2*g]=8191&f,f>>>=13,c[2*g+1]=8191&f,f>>>=13;for(g=2*b;g<e;++g)c[g]=0;d(0===f),d(0===(f&-8192))},m.prototype.stub=function(a){for(var b=new Array(a),c=0;c<a;c++)b[c]=0;return b},m.prototype.mulp=function(a,b,c){var d=2*this.guessLen13b(a.length,b.length),e=this.makeRBT(d),f=this.stub(d),g=new Array(d),h=new Array(d),i=new Array(d),j=new Array(d),k=new Array(d),l=new Array(d),m=c.words;m.length=d,this.convert13b(a.words,a.length,g,d),this.convert13b(b.words,b.length,j,d),this.transform(g,f,h,i,d,e),this.transform(j,f,k,l,d,e);for(var n=0;n<d;n++){var o=h[n]*k[n]-i[n]*l[n];i[n]=h[n]*l[n]+i[n]*k[n],h[n]=o}return this.conjugate(h,i,d),this.transform(h,i,m,f,d,e),this.conjugate(m,f,d),this.normalize13b(m,d),c.negative=a.negative^b.negative,c.length=a.length+b.length,c.strip()},f.prototype.mul=function(a){var b=new f(null);return b.words=new Array(this.length+a.length),this.mulTo(a,b)},f.prototype.mulf=function(a){var b=new f(null);return b.words=new Array(this.length+a.length),l(this,a,b)},f.prototype.imul=function(a){return this.clone().mulTo(a,this)},f.prototype.imuln=function(a){d("number"==typeof a),d(a<67108864);for(var b=0,c=0;c<this.length;c++){var e=(0|this.words[c])*a,f=(67108863&e)+(67108863&b);b>>=26,b+=e/67108864|0,b+=f>>>26,this.words[c]=67108863&f}return 0!==b&&(this.words[c]=b,this.length++),this},f.prototype.muln=function(a){return this.clone().imuln(a)},f.prototype.sqr=function(){return this.mul(this)},f.prototype.isqr=function(){return this.imul(this.clone())},f.prototype.pow=function(a){var b=i(a);if(0===b.length)return new f(1);for(var c=this,d=0;d<b.length&&0===b[d];d++,c=c.sqr());if(++d<b.length)for(var e=c.sqr();d<b.length;d++,e=e.sqr())0!==b[d]&&(c=c.mul(e));return c},f.prototype.iushln=function(a){d("number"==typeof a&&a>=0);var b,c=a%26,e=(a-c)/26,f=67108863>>>26-c<<26-c;if(0!==c){var g=0;for(b=0;b<this.length;b++){var h=this.words[b]&f,i=(0|this.words[b])-h<<c;this.words[b]=i|g,g=h>>>26-c}g&&(this.words[b]=g,this.length++)}if(0!==e){for(b=this.length-1;b>=0;b--)this.words[b+e]=this.words[b];for(b=0;b<e;b++)this.words[b]=0;this.length+=e}return this.strip()},f.prototype.ishln=function(a){return d(0===this.negative),this.iushln(a)},f.prototype.iushrn=function(a,b,c){d("number"==typeof a&&a>=0);var e;e=b?(b-b%26)/26:0;var f=a%26,g=Math.min((a-f)/26,this.length),h=67108863^67108863>>>f<<f,i=c;if(e-=g,e=Math.max(0,e),i){for(var j=0;j<g;j++)i.words[j]=this.words[j];i.length=g}if(0===g);else if(this.length>g)for(this.length-=g,j=0;j<this.length;j++)this.words[j]=this.words[j+g];else this.words[0]=0,this.length=1;var k=0;for(j=this.length-1;j>=0&&(0!==k||j>=e);j--){var l=0|this.words[j];this.words[j]=k<<26-f|l>>>f,k=l&h}return i&&0!==k&&(i.words[i.length++]=k),0===this.length&&(this.words[0]=0,this.length=1),this.strip()},f.prototype.ishrn=function(a,b,c){return d(0===this.negative),this.iushrn(a,b,c)},f.prototype.shln=function(a){return this.clone().ishln(a)},f.prototype.ushln=function(a){return this.clone().iushln(a)},f.prototype.shrn=function(a){return this.clone().ishrn(a)},f.prototype.ushrn=function(a){return this.clone().iushrn(a)},f.prototype.testn=function(a){d("number"==typeof a&&a>=0);var b=a%26,c=(a-b)/26,e=1<<b;if(this.length<=c)return!1;var f=this.words[c];return!!(f&e)},f.prototype.imaskn=function(a){d("number"==typeof a&&a>=0);var b=a%26,c=(a-b)/26;if(d(0===this.negative,"imaskn works only with positive numbers"),this.length<=c)return this;if(0!==b&&c++,this.length=Math.min(c,this.length),0!==b){var e=67108863^67108863>>>b<<b;this.words[this.length-1]&=e}return this.strip()},f.prototype.maskn=function(a){return this.clone().imaskn(a)},f.prototype.iaddn=function(a){return d("number"==typeof a),d(a<67108864),a<0?this.isubn(-a):0!==this.negative?1===this.length&&(0|this.words[0])<a?(this.words[0]=a-(0|this.words[0]),this.negative=0,this):(this.negative=0,this.isubn(a),this.negative=1,this):this._iaddn(a)},f.prototype._iaddn=function(a){this.words[0]+=a;for(var b=0;b<this.length&&this.words[b]>=67108864;b++)this.words[b]-=67108864,b===this.length-1?this.words[b+1]=1:this.words[b+1]++;return this.length=Math.max(this.length,b+1),this},f.prototype.isubn=function(a){if(d("number"==typeof a),d(a<67108864),a<0)return this.iaddn(-a);if(0!==this.negative)return this.negative=0,this.iaddn(a),this.negative=1,this;if(this.words[0]-=a,1===this.length&&this.words[0]<0)this.words[0]=-this.words[0],this.negative=1;else for(var b=0;b<this.length&&this.words[b]<0;b++)this.words[b]+=67108864,this.words[b+1]-=1;return this.strip()},f.prototype.addn=function(a){return this.clone().iaddn(a)},f.prototype.subn=function(a){return this.clone().isubn(a)},f.prototype.iabs=function(){return this.negative=0,this},f.prototype.abs=function(){return this.clone().iabs()},f.prototype._ishlnsubmul=function(a,b,c){var e,f=a.length+c;this._expand(f);var g,h=0;for(e=0;e<a.length;e++){g=(0|this.words[e+c])+h;var i=(0|a.words[e])*b;g-=67108863&i,h=(g>>26)-(i/67108864|0),this.words[e+c]=67108863&g}for(;e<this.length-c;e++)g=(0|this.words[e+c])+h,h=g>>26,this.words[e+c]=67108863&g;if(0===h)return this.strip();for(d(h===-1),h=0,e=0;e<this.length;e++)g=-(0|this.words[e])+h,h=g>>26,this.words[e]=67108863&g;return this.negative=1,this.strip()},f.prototype._wordDiv=function(a,b){var c=this.length-a.length,d=this.clone(),e=a,g=0|e.words[e.length-1],h=this._countBits(g);c=26-h,0!==c&&(e=e.ushln(c),d.iushln(c),g=0|e.words[e.length-1]);var i,j=d.length-e.length;if("mod"!==b){i=new f(null),i.length=j+1,i.words=new Array(i.length);for(var k=0;k<i.length;k++)i.words[k]=0}var l=d.clone()._ishlnsubmul(e,1,j);0===l.negative&&(d=l,i&&(i.words[j]=1));for(var m=j-1;m>=0;m--){var n=67108864*(0|d.words[e.length+m])+(0|d.words[e.length+m-1]);for(n=Math.min(n/g|0,67108863),d._ishlnsubmul(e,n,m);0!==d.negative;)n--,d.negative=0,d._ishlnsubmul(e,1,m),d.isZero()||(d.negative^=1);
i&&(i.words[m]=n)}return i&&i.strip(),d.strip(),"div"!==b&&0!==c&&d.iushrn(c),{div:i||null,mod:d}},f.prototype.divmod=function(a,b,c){if(d(!a.isZero()),this.isZero())return{div:new f(0),mod:new f(0)};var e,g,h;return 0!==this.negative&&0===a.negative?(h=this.neg().divmod(a,b),"mod"!==b&&(e=h.div.neg()),"div"!==b&&(g=h.mod.neg(),c&&0!==g.negative&&g.iadd(a)),{div:e,mod:g}):0===this.negative&&0!==a.negative?(h=this.divmod(a.neg(),b),"mod"!==b&&(e=h.div.neg()),{div:e,mod:h.mod}):0!==(this.negative&a.negative)?(h=this.neg().divmod(a.neg(),b),"div"!==b&&(g=h.mod.neg(),c&&0!==g.negative&&g.isub(a)),{div:h.div,mod:g}):a.length>this.length||this.cmp(a)<0?{div:new f(0),mod:this}:1===a.length?"div"===b?{div:this.divn(a.words[0]),mod:null}:"mod"===b?{div:null,mod:new f(this.modn(a.words[0]))}:{div:this.divn(a.words[0]),mod:new f(this.modn(a.words[0]))}:this._wordDiv(a,b)},f.prototype.div=function(a){return this.divmod(a,"div",!1).div},f.prototype.mod=function(a){return this.divmod(a,"mod",!1).mod},f.prototype.umod=function(a){return this.divmod(a,"mod",!0).mod},f.prototype.divRound=function(a){var b=this.divmod(a);if(b.mod.isZero())return b.div;var c=0!==b.div.negative?b.mod.isub(a):b.mod,d=a.ushrn(1),e=a.andln(1),f=c.cmp(d);return f<0||1===e&&0===f?b.div:0!==b.div.negative?b.div.isubn(1):b.div.iaddn(1)},f.prototype.modn=function(a){d(a<=67108863);for(var b=(1<<26)%a,c=0,e=this.length-1;e>=0;e--)c=(b*c+(0|this.words[e]))%a;return c},f.prototype.idivn=function(a){d(a<=67108863);for(var b=0,c=this.length-1;c>=0;c--){var e=(0|this.words[c])+67108864*b;this.words[c]=e/a|0,b=e%a}return this.strip()},f.prototype.divn=function(a){return this.clone().idivn(a)},f.prototype.egcd=function(a){d(0===a.negative),d(!a.isZero());var b=this,c=a.clone();b=0!==b.negative?b.umod(a):b.clone();for(var e=new f(1),g=new f(0),h=new f(0),i=new f(1),j=0;b.isEven()&&c.isEven();)b.iushrn(1),c.iushrn(1),++j;for(var k=c.clone(),l=b.clone();!b.isZero();){for(var m=0,n=1;0===(b.words[0]&n)&&m<26;++m,n<<=1);if(m>0)for(b.iushrn(m);m-- >0;)(e.isOdd()||g.isOdd())&&(e.iadd(k),g.isub(l)),e.iushrn(1),g.iushrn(1);for(var o=0,p=1;0===(c.words[0]&p)&&o<26;++o,p<<=1);if(o>0)for(c.iushrn(o);o-- >0;)(h.isOdd()||i.isOdd())&&(h.iadd(k),i.isub(l)),h.iushrn(1),i.iushrn(1);b.cmp(c)>=0?(b.isub(c),e.isub(h),g.isub(i)):(c.isub(b),h.isub(e),i.isub(g))}return{a:h,b:i,gcd:c.iushln(j)}},f.prototype._invmp=function(a){d(0===a.negative),d(!a.isZero());var b=this,c=a.clone();b=0!==b.negative?b.umod(a):b.clone();for(var e=new f(1),g=new f(0),h=c.clone();b.cmpn(1)>0&&c.cmpn(1)>0;){for(var i=0,j=1;0===(b.words[0]&j)&&i<26;++i,j<<=1);if(i>0)for(b.iushrn(i);i-- >0;)e.isOdd()&&e.iadd(h),e.iushrn(1);for(var k=0,l=1;0===(c.words[0]&l)&&k<26;++k,l<<=1);if(k>0)for(c.iushrn(k);k-- >0;)g.isOdd()&&g.iadd(h),g.iushrn(1);b.cmp(c)>=0?(b.isub(c),e.isub(g)):(c.isub(b),g.isub(e))}var m;return m=0===b.cmpn(1)?e:g,m.cmpn(0)<0&&m.iadd(a),m},f.prototype.gcd=function(a){if(this.isZero())return a.abs();if(a.isZero())return this.abs();var b=this.clone(),c=a.clone();b.negative=0,c.negative=0;for(var d=0;b.isEven()&&c.isEven();d++)b.iushrn(1),c.iushrn(1);for(;;){for(;b.isEven();)b.iushrn(1);for(;c.isEven();)c.iushrn(1);var e=b.cmp(c);if(e<0){var f=b;b=c,c=f}else if(0===e||0===c.cmpn(1))break;b.isub(c)}return c.iushln(d)},f.prototype.invm=function(a){return this.egcd(a).a.umod(a)},f.prototype.isEven=function(){return 0===(1&this.words[0])},f.prototype.isOdd=function(){return 1===(1&this.words[0])},f.prototype.andln=function(a){return this.words[0]&a},f.prototype.bincn=function(a){d("number"==typeof a);var b=a%26,c=(a-b)/26,e=1<<b;if(this.length<=c)return this._expand(c+1),this.words[c]|=e,this;for(var f=e,g=c;0!==f&&g<this.length;g++){var h=0|this.words[g];h+=f,f=h>>>26,h&=67108863,this.words[g]=h}return 0!==f&&(this.words[g]=f,this.length++),this},f.prototype.isZero=function(){return 1===this.length&&0===this.words[0]},f.prototype.cmpn=function(a){var b=a<0;if(0!==this.negative&&!b)return-1;if(0===this.negative&&b)return 1;this.strip();var c;if(this.length>1)c=1;else{b&&(a=-a),d(a<=67108863,"Number is too big");var e=0|this.words[0];c=e===a?0:e<a?-1:1}return 0!==this.negative?0|-c:c},f.prototype.cmp=function(a){if(0!==this.negative&&0===a.negative)return-1;if(0===this.negative&&0!==a.negative)return 1;var b=this.ucmp(a);return 0!==this.negative?0|-b:b},f.prototype.ucmp=function(a){if(this.length>a.length)return 1;if(this.length<a.length)return-1;for(var b=0,c=this.length-1;c>=0;c--){var d=0|this.words[c],e=0|a.words[c];if(d!==e){d<e?b=-1:d>e&&(b=1);break}}return b},f.prototype.gtn=function(a){return 1===this.cmpn(a)},f.prototype.gt=function(a){return 1===this.cmp(a)},f.prototype.gten=function(a){return this.cmpn(a)>=0},f.prototype.gte=function(a){return this.cmp(a)>=0},f.prototype.ltn=function(a){return this.cmpn(a)===-1},f.prototype.lt=function(a){return this.cmp(a)===-1},f.prototype.lten=function(a){return this.cmpn(a)<=0},f.prototype.lte=function(a){return this.cmp(a)<=0},f.prototype.eqn=function(a){return 0===this.cmpn(a)},f.prototype.eq=function(a){return 0===this.cmp(a)},f.red=function(a){return new s(a)},f.prototype.toRed=function(a){return d(!this.red,"Already a number in reduction context"),d(0===this.negative,"red works only with positives"),a.convertTo(this)._forceRed(a)},f.prototype.fromRed=function(){return d(this.red,"fromRed works only with numbers in reduction context"),this.red.convertFrom(this)},f.prototype._forceRed=function(a){return this.red=a,this},f.prototype.forceRed=function(a){return d(!this.red,"Already a number in reduction context"),this._forceRed(a)},f.prototype.redAdd=function(a){return d(this.red,"redAdd works only with red numbers"),this.red.add(this,a)},f.prototype.redIAdd=function(a){return d(this.red,"redIAdd works only with red numbers"),this.red.iadd(this,a)},f.prototype.redSub=function(a){return d(this.red,"redSub works only with red numbers"),this.red.sub(this,a)},f.prototype.redISub=function(a){return d(this.red,"redISub works only with red numbers"),this.red.isub(this,a)},f.prototype.redShl=function(a){return d(this.red,"redShl works only with red numbers"),this.red.shl(this,a)},f.prototype.redMul=function(a){return d(this.red,"redMul works only with red numbers"),this.red._verify2(this,a),this.red.mul(this,a)},f.prototype.redIMul=function(a){return d(this.red,"redMul works only with red numbers"),this.red._verify2(this,a),this.red.imul(this,a)},f.prototype.redSqr=function(){return d(this.red,"redSqr works only with red numbers"),this.red._verify1(this),this.red.sqr(this)},f.prototype.redISqr=function(){return d(this.red,"redISqr works only with red numbers"),this.red._verify1(this),this.red.isqr(this)},f.prototype.redSqrt=function(){return d(this.red,"redSqrt works only with red numbers"),this.red._verify1(this),this.red.sqrt(this)},f.prototype.redInvm=function(){return d(this.red,"redInvm works only with red numbers"),this.red._verify1(this),this.red.invm(this)},f.prototype.redNeg=function(){return d(this.red,"redNeg works only with red numbers"),this.red._verify1(this),this.red.neg(this)},f.prototype.redPow=function(a){return d(this.red&&!a.red,"redPow(normalNum)"),this.red._verify1(this),this.red.pow(this,a)};var A={k256:null,p224:null,p192:null,p25519:null};n.prototype._tmp=function(){var a=new f(null);return a.words=new Array(Math.ceil(this.n/13)),a},n.prototype.ireduce=function(a){var b,c=a;do this.split(c,this.tmp),c=this.imulK(c),c=c.iadd(this.tmp),b=c.bitLength();while(b>this.n);var d=b<this.n?-1:c.ucmp(this.p);return 0===d?(c.words[0]=0,c.length=1):d>0?c.isub(this.p):c.strip(),c},n.prototype.split=function(a,b){a.iushrn(this.n,0,b)},n.prototype.imulK=function(a){return a.imul(this.k)},e(o,n),o.prototype.split=function(a,b){for(var c=4194303,d=Math.min(a.length,9),e=0;e<d;e++)b.words[e]=a.words[e];if(b.length=d,a.length<=9)return a.words[0]=0,void(a.length=1);var f=a.words[9];for(b.words[b.length++]=f&c,e=10;e<a.length;e++){var g=0|a.words[e];a.words[e-10]=(g&c)<<4|f>>>22,f=g}f>>>=22,a.words[e-10]=f,0===f&&a.length>10?a.length-=10:a.length-=9},o.prototype.imulK=function(a){a.words[a.length]=0,a.words[a.length+1]=0,a.length+=2;for(var b=0,c=0;c<a.length;c++){var d=0|a.words[c];b+=977*d,a.words[c]=67108863&b,b=64*d+(b/67108864|0)}return 0===a.words[a.length-1]&&(a.length--,0===a.words[a.length-1]&&a.length--),a},e(p,n),e(q,n),e(r,n),r.prototype.imulK=function(a){for(var b=0,c=0;c<a.length;c++){var d=19*(0|a.words[c])+b,e=67108863&d;d>>>=26,a.words[c]=e,b=d}return 0!==b&&(a.words[a.length++]=b),a},f._prime=function B(a){if(A[a])return A[a];var B;if("k256"===a)B=new o;else if("p224"===a)B=new p;else if("p192"===a)B=new q;else{if("p25519"!==a)throw new Error("Unknown prime "+a);B=new r}return A[a]=B,B},s.prototype._verify1=function(a){d(0===a.negative,"red works only with positives"),d(a.red,"red works only with red numbers")},s.prototype._verify2=function(a,b){d(0===(a.negative|b.negative),"red works only with positives"),d(a.red&&a.red===b.red,"red works only with red numbers")},s.prototype.imod=function(a){return this.prime?this.prime.ireduce(a)._forceRed(this):a.umod(this.m)._forceRed(this)},s.prototype.neg=function(a){return a.isZero()?a.clone():this.m.sub(a)._forceRed(this)},s.prototype.add=function(a,b){this._verify2(a,b);var c=a.add(b);return c.cmp(this.m)>=0&&c.isub(this.m),c._forceRed(this)},s.prototype.iadd=function(a,b){this._verify2(a,b);var c=a.iadd(b);return c.cmp(this.m)>=0&&c.isub(this.m),c},s.prototype.sub=function(a,b){this._verify2(a,b);var c=a.sub(b);return c.cmpn(0)<0&&c.iadd(this.m),c._forceRed(this)},s.prototype.isub=function(a,b){this._verify2(a,b);var c=a.isub(b);return c.cmpn(0)<0&&c.iadd(this.m),c},s.prototype.shl=function(a,b){return this._verify1(a),this.imod(a.ushln(b))},s.prototype.imul=function(a,b){return this._verify2(a,b),this.imod(a.imul(b))},s.prototype.mul=function(a,b){return this._verify2(a,b),this.imod(a.mul(b))},s.prototype.isqr=function(a){return this.imul(a,a.clone())},s.prototype.sqr=function(a){return this.mul(a,a)},s.prototype.sqrt=function(a){if(a.isZero())return a.clone();var b=this.m.andln(3);if(d(b%2===1),3===b){var c=this.m.add(new f(1)).iushrn(2);return this.pow(a,c)}for(var e=this.m.subn(1),g=0;!e.isZero()&&0===e.andln(1);)g++,e.iushrn(1);d(!e.isZero());var h=new f(1).toRed(this),i=h.redNeg(),j=this.m.subn(1).iushrn(1),k=this.m.bitLength();for(k=new f(2*k*k).toRed(this);0!==this.pow(k,j).cmp(i);)k.redIAdd(i);for(var l=this.pow(k,e),m=this.pow(a,e.addn(1).iushrn(1)),n=this.pow(a,e),o=g;0!==n.cmp(h);){for(var p=n,q=0;0!==p.cmp(h);q++)p=p.redSqr();d(q<o);var r=this.pow(l,new f(1).iushln(o-q-1));m=m.redMul(r),l=r.redSqr(),n=n.redMul(l),o=q}return m},s.prototype.invm=function(a){var b=a._invmp(this.m);return 0!==b.negative?(b.negative=0,this.imod(b).redNeg()):this.imod(b)},s.prototype.pow=function(a,b){if(b.isZero())return new f(1);if(0===b.cmpn(1))return a.clone();var c=4,d=new Array(1<<c);d[0]=new f(1).toRed(this),d[1]=a;for(var e=2;e<d.length;e++)d[e]=this.mul(d[e-1],a);var g=d[0],h=0,i=0,j=b.bitLength()%26;for(0===j&&(j=26),e=b.length-1;e>=0;e--){for(var k=b.words[e],l=j-1;l>=0;l--){var m=k>>l&1;g!==d[0]&&(g=this.sqr(g)),0!==m||0!==h?(h<<=1,h|=m,i++,(i===c||0===e&&0===l)&&(g=this.mul(g,d[h]),i=0,h=0)):i=0}j=26}return g},s.prototype.convertTo=function(a){var b=a.umod(this.m);return b===a?b.clone():b},s.prototype.convertFrom=function(a){var b=a.clone();return b.red=null,b},f.mont=function(a){return new t(a)},e(t,s),t.prototype.convertTo=function(a){return this.imod(a.ushln(this.shift))},t.prototype.convertFrom=function(a){var b=this.imod(a.mul(this.rinv));return b.red=null,b},t.prototype.imul=function(a,b){if(a.isZero()||b.isZero())return a.words[0]=0,a.length=1,a;var c=a.imul(b),d=c.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),e=c.isub(d).iushrn(this.shift),f=e;return e.cmp(this.m)>=0?f=e.isub(this.m):e.cmpn(0)<0&&(f=e.iadd(this.m)),f._forceRed(this)},t.prototype.mul=function(a,b){if(a.isZero()||b.isZero())return new f(0)._forceRed(this);var c=a.mul(b),d=c.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),e=c.isub(d).iushrn(this.shift),g=e;return e.cmp(this.m)>=0?g=e.isub(this.m):e.cmpn(0)<0&&(g=e.iadd(this.m)),g._forceRed(this)},t.prototype.invm=function(a){var b=this.imod(a._invmp(this.m).mul(this.r2));return b._forceRed(this)}}("undefined"==typeof b||b,this)},{}],17:[function(a,b,c){function d(a){this.rand=a}var e;if(b.exports=function(a){return e||(e=new d(null)),e.generate(a)},b.exports.Rand=d,d.prototype.generate=function(a){return this._rand(a)},"object"==typeof self)self.crypto&&self.crypto.getRandomValues?d.prototype._rand=function(a){var b=new Uint8Array(a);return self.crypto.getRandomValues(b),b}:self.msCrypto&&self.msCrypto.getRandomValues?d.prototype._rand=function(a){var b=new Uint8Array(a);return self.msCrypto.getRandomValues(b),b}:d.prototype._rand=function(){throw new Error("Not implemented yet")};else try{var f=a("crypto");d.prototype._rand=function(a){return f.randomBytes(a)}}catch(g){d.prototype._rand=function(a){for(var b=new Uint8Array(a),c=0;c<b.length;c++)b[c]=this.rand.getByte();return b}}},{crypto:18}],18:[function(a,b,c){},{}],19:[function(a,b,c){var d=c;d.utils=a("./hash/utils"),d.common=a("./hash/common"),d.sha=a("./hash/sha"),d.ripemd=a("./hash/ripemd"),d.hmac=a("./hash/hmac"),d.sha1=d.sha.sha1,d.sha256=d.sha.sha256,d.sha224=d.sha.sha224,d.sha384=d.sha.sha384,d.sha512=d.sha.sha512,d.ripemd160=d.ripemd.ripemd160},{"./hash/common":20,"./hash/hmac":21,"./hash/ripemd":22,"./hash/sha":23,"./hash/utils":24}],20:[function(a,b,c){function d(){this.pending=null,this.pendingTotal=0,this.blockSize=this.constructor.blockSize,this.outSize=this.constructor.outSize,this.hmacStrength=this.constructor.hmacStrength,this.padLength=this.constructor.padLength/8,this.endian="big",this._delta8=this.blockSize/8,this._delta32=this.blockSize/32}var e=a("../hash"),f=e.utils,g=f.assert;c.BlockHash=d,d.prototype.update=function(a,b){if(a=f.toArray(a,b),this.pending?this.pending=this.pending.concat(a):this.pending=a,this.pendingTotal+=a.length,this.pending.length>=this._delta8){a=this.pending;var c=a.length%this._delta8;this.pending=a.slice(a.length-c,a.length),0===this.pending.length&&(this.pending=null),a=f.join32(a,0,a.length-c,this.endian);for(var d=0;d<a.length;d+=this._delta32)this._update(a,d,d+this._delta32)}return this},d.prototype.digest=function(a){return this.update(this._pad()),g(null===this.pending),this._digest(a)},d.prototype._pad=function(){var a=this.pendingTotal,b=this._delta8,c=b-(a+this.padLength)%b,d=new Array(c+this.padLength);d[0]=128;for(var e=1;e<c;e++)d[e]=0;if(a<<=3,"big"===this.endian){for(var f=8;f<this.padLength;f++)d[e++]=0;d[e++]=0,d[e++]=0,d[e++]=0,d[e++]=0,d[e++]=a>>>24&255,d[e++]=a>>>16&255,d[e++]=a>>>8&255,d[e++]=255&a}else{d[e++]=255&a,d[e++]=a>>>8&255,d[e++]=a>>>16&255,d[e++]=a>>>24&255,d[e++]=0,d[e++]=0,d[e++]=0,d[e++]=0;for(var f=8;f<this.padLength;f++)d[e++]=0}return d}},{"../hash":19}],21:[function(a,b,c){function d(a,b,c){return this instanceof d?(this.Hash=a,this.blockSize=a.blockSize/8,this.outSize=a.outSize/8,this.inner=null,this.outer=null,void this._init(f.toArray(b,c))):new d(a,b,c)}var e=a("../hash"),f=e.utils,g=f.assert;b.exports=d,d.prototype._init=function(a){a.length>this.blockSize&&(a=(new this.Hash).update(a).digest()),g(a.length<=this.blockSize);for(var b=a.length;b<this.blockSize;b++)a.push(0);for(var b=0;b<a.length;b++)a[b]^=54;this.inner=(new this.Hash).update(a);for(var b=0;b<a.length;b++)a[b]^=106;this.outer=(new this.Hash).update(a)},d.prototype.update=function(a,b){return this.inner.update(a,b),this},d.prototype.digest=function(a){return this.outer.update(this.inner.digest()),this.outer.digest(a)}},{"../hash":19}],22:[function(a,b,c){function d(){return this instanceof d?(n.call(this),this.h=[1732584193,4023233417,2562383102,271733878,3285377520],void(this.endian="little")):new d}function e(a,b,c,d){return a<=15?b^c^d:a<=31?b&c|~b&d:a<=47?(b|~c)^d:a<=63?b&d|c&~d:b^(c|~d)}function f(a){return a<=15?0:a<=31?1518500249:a<=47?1859775393:a<=63?2400959708:2840853838}function g(a){return a<=15?1352829926:a<=31?1548603684:a<=47?1836072691:a<=63?2053994217:0}var h=a("../hash"),i=h.utils,j=i.rotl32,k=i.sum32,l=i.sum32_3,m=i.sum32_4,n=h.common.BlockHash;i.inherits(d,n),c.ripemd160=d,d.blockSize=512,d.outSize=160,d.hmacStrength=192,d.padLength=64,d.prototype._update=function(a,b){for(var c=this.h[0],d=this.h[1],h=this.h[2],i=this.h[3],n=this.h[4],s=c,t=d,u=h,v=i,w=n,x=0;x<80;x++){var y=k(j(m(c,e(x,d,h,i),a[o[x]+b],f(x)),q[x]),n);c=n,n=i,i=j(h,10),h=d,d=y,y=k(j(m(s,e(79-x,t,u,v),a[p[x]+b],g(x)),r[x]),w),s=w,w=v,v=j(u,10),u=t,t=y}y=l(this.h[1],h,v),this.h[1]=l(this.h[2],i,w),this.h[2]=l(this.h[3],n,s),this.h[3]=l(this.h[4],c,t),this.h[4]=l(this.h[0],d,u),this.h[0]=y},d.prototype._digest=function(a){return"hex"===a?i.toHex32(this.h,"little"):i.split32(this.h,"little")};var o=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13],p=[5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11],q=[11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6],r=[8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11]},{"../hash":19}],23:[function(a,b,c){function d(){return this instanceof d?(V.call(this),this.h=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],this.k=W,void(this.W=new Array(64))):new d}function e(){return this instanceof e?(d.call(this),void(this.h=[3238371032,914150663,812702999,4144912697,4290775857,1750603025,1694076839,3204075428])):new e}function f(){return this instanceof f?(V.call(this),this.h=[1779033703,4089235720,3144134277,2227873595,1013904242,4271175723,2773480762,1595750129,1359893119,2917565137,2600822924,725511199,528734635,4215389547,1541459225,327033209],this.k=X,void(this.W=new Array(160))):new f}function g(){return this instanceof g?(f.call(this),void(this.h=[3418070365,3238371032,1654270250,914150663,2438529370,812702999,355462360,4144912697,1731405415,4290775857,2394180231,1750603025,3675008525,1694076839,1203062813,3204075428])):new g}function h(){return this instanceof h?(V.call(this),this.h=[1732584193,4023233417,2562383102,271733878,3285377520],void(this.W=new Array(80))):new h}function i(a,b,c){return a&b^~a&c}function j(a,b,c){return a&b^a&c^b&c}function k(a,b,c){return a^b^c}function l(a){return F(a,2)^F(a,13)^F(a,22)}function m(a){return F(a,6)^F(a,11)^F(a,25)}function n(a){return F(a,7)^F(a,18)^a>>>3}function o(a){return F(a,17)^F(a,19)^a>>>10}function p(a,b,c,d){return 0===a?i(b,c,d):1===a||3===a?k(b,c,d):2===a?j(b,c,d):void 0}function q(a,b,c,d,e,f){var g=a&c^~a&e;return g<0&&(g+=4294967296),g}function r(a,b,c,d,e,f){var g=b&d^~b&f;return g<0&&(g+=4294967296),g}function s(a,b,c,d,e,f){var g=a&c^a&e^c&e;return g<0&&(g+=4294967296),g}function t(a,b,c,d,e,f){var g=b&d^b&f^d&f;return g<0&&(g+=4294967296),g}function u(a,b){var c=K(a,b,28),d=K(b,a,2),e=K(b,a,7),f=c^d^e;return f<0&&(f+=4294967296),f}function v(a,b){var c=L(a,b,28),d=L(b,a,2),e=L(b,a,7),f=c^d^e;return f<0&&(f+=4294967296),f}function w(a,b){var c=K(a,b,14),d=K(a,b,18),e=K(b,a,9),f=c^d^e;return f<0&&(f+=4294967296),f}function x(a,b){var c=L(a,b,14),d=L(a,b,18),e=L(b,a,9),f=c^d^e;return f<0&&(f+=4294967296),f}function y(a,b){var c=K(a,b,1),d=K(a,b,8),e=M(a,b,7),f=c^d^e;return f<0&&(f+=4294967296),f}function z(a,b){var c=L(a,b,1),d=L(a,b,8),e=N(a,b,7),f=c^d^e;return f<0&&(f+=4294967296),f}function A(a,b){var c=K(a,b,19),d=K(b,a,29),e=M(a,b,6),f=c^d^e;return f<0&&(f+=4294967296),f}function B(a,b){var c=L(a,b,19),d=L(b,a,29),e=N(a,b,6),f=c^d^e;return f<0&&(f+=4294967296),f}var C=a("../hash"),D=C.utils,E=D.assert,F=D.rotr32,G=D.rotl32,H=D.sum32,I=D.sum32_4,J=D.sum32_5,K=D.rotr64_hi,L=D.rotr64_lo,M=D.shr64_hi,N=D.shr64_lo,O=D.sum64,P=D.sum64_hi,Q=D.sum64_lo,R=D.sum64_4_hi,S=D.sum64_4_lo,T=D.sum64_5_hi,U=D.sum64_5_lo,V=C.common.BlockHash,W=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],X=[1116352408,3609767458,1899447441,602891725,3049323471,3964484399,3921009573,2173295548,961987163,4081628472,1508970993,3053834265,2453635748,2937671579,2870763221,3664609560,3624381080,2734883394,310598401,1164996542,607225278,1323610764,1426881987,3590304994,1925078388,4068182383,2162078206,991336113,2614888103,633803317,3248222580,3479774868,3835390401,2666613458,4022224774,944711139,264347078,2341262773,604807628,2007800933,770255983,1495990901,1249150122,1856431235,1555081692,3175218132,1996064986,2198950837,2554220882,3999719339,2821834349,766784016,2952996808,2566594879,3210313671,3203337956,3336571891,1034457026,3584528711,2466948901,113926993,3758326383,338241895,168717936,666307205,1188179964,773529912,1546045734,1294757372,1522805485,1396182291,2643833823,1695183700,2343527390,1986661051,1014477480,2177026350,1206759142,2456956037,344077627,2730485921,1290863460,2820302411,3158454273,3259730800,3505952657,3345764771,106217008,3516065817,3606008344,3600352804,1432725776,4094571909,1467031594,275423344,851169720,430227734,3100823752,506948616,1363258195,659060556,3750685593,883997877,3785050280,958139571,3318307427,1322822218,3812723403,1537002063,2003034995,1747873779,3602036899,1955562222,1575990012,2024104815,1125592928,2227730452,2716904306,2361852424,442776044,2428436474,593698344,2756734187,3733110249,3204031479,2999351573,3329325298,3815920427,3391569614,3928383900,3515267271,566280711,3940187606,3454069534,4118630271,4000239992,116418474,1914138554,174292421,2731055270,289380356,3203993006,460393269,320620315,685471733,587496836,852142971,1086792851,1017036298,365543100,1126000580,2618297676,1288033470,3409855158,1501505948,4234509866,1607167915,987167468,1816402316,1246189591],Y=[1518500249,1859775393,2400959708,3395469782];D.inherits(d,V),c.sha256=d,d.blockSize=512,d.outSize=256,d.hmacStrength=192,d.padLength=64,d.prototype._update=function(a,b){for(var c=this.W,d=0;d<16;d++)c[d]=a[b+d];for(;d<c.length;d++)c[d]=I(o(c[d-2]),c[d-7],n(c[d-15]),c[d-16]);var e=this.h[0],f=this.h[1],g=this.h[2],h=this.h[3],k=this.h[4],p=this.h[5],q=this.h[6],r=this.h[7];E(this.k.length===c.length);for(var d=0;d<c.length;d++){var s=J(r,m(k),i(k,p,q),this.k[d],c[d]),t=H(l(e),j(e,f,g));r=q,q=p,p=k,k=H(h,s),h=g,g=f,f=e,e=H(s,t)}this.h[0]=H(this.h[0],e),this.h[1]=H(this.h[1],f),this.h[2]=H(this.h[2],g),this.h[3]=H(this.h[3],h),this.h[4]=H(this.h[4],k),this.h[5]=H(this.h[5],p),this.h[6]=H(this.h[6],q),this.h[7]=H(this.h[7],r)},d.prototype._digest=function(a){return"hex"===a?D.toHex32(this.h,"big"):D.split32(this.h,"big")},D.inherits(e,d),c.sha224=e,e.blockSize=512,e.outSize=224,e.hmacStrength=192,e.padLength=64,e.prototype._digest=function(a){return"hex"===a?D.toHex32(this.h.slice(0,7),"big"):D.split32(this.h.slice(0,7),"big")},D.inherits(f,V),c.sha512=f,f.blockSize=1024,f.outSize=512,f.hmacStrength=192,f.padLength=128,f.prototype._prepareBlock=function(a,b){for(var c=this.W,d=0;d<32;d++)c[d]=a[b+d];for(;d<c.length;d+=2){var e=A(c[d-4],c[d-3]),f=B(c[d-4],c[d-3]),g=c[d-14],h=c[d-13],i=y(c[d-30],c[d-29]),j=z(c[d-30],c[d-29]),k=c[d-32],l=c[d-31];c[d]=R(e,f,g,h,i,j,k,l),c[d+1]=S(e,f,g,h,i,j,k,l)}},f.prototype._update=function(a,b){this._prepareBlock(a,b);var c=this.W,d=this.h[0],e=this.h[1],f=this.h[2],g=this.h[3],h=this.h[4],i=this.h[5],j=this.h[6],k=this.h[7],l=this.h[8],m=this.h[9],n=this.h[10],o=this.h[11],p=this.h[12],y=this.h[13],z=this.h[14],A=this.h[15];E(this.k.length===c.length);for(var B=0;B<c.length;B+=2){var C=z,D=A,F=w(l,m),G=x(l,m),H=q(l,m,n,o,p,y),I=r(l,m,n,o,p,y),J=this.k[B],K=this.k[B+1],L=c[B],M=c[B+1],N=T(C,D,F,G,H,I,J,K,L,M),R=U(C,D,F,G,H,I,J,K,L,M),C=u(d,e),D=v(d,e),F=s(d,e,f,g,h,i),G=t(d,e,f,g,h,i),S=P(C,D,F,G),V=Q(C,D,F,G);z=p,A=y,p=n,y=o,n=l,o=m,l=P(j,k,N,R),m=Q(k,k,N,R),j=h,k=i,h=f,i=g,f=d,g=e,d=P(N,R,S,V),e=Q(N,R,S,V)}O(this.h,0,d,e),O(this.h,2,f,g),O(this.h,4,h,i),O(this.h,6,j,k),O(this.h,8,l,m),O(this.h,10,n,o),O(this.h,12,p,y),O(this.h,14,z,A)},f.prototype._digest=function(a){return"hex"===a?D.toHex32(this.h,"big"):D.split32(this.h,"big")},D.inherits(g,f),c.sha384=g,g.blockSize=1024,g.outSize=384,g.hmacStrength=192,g.padLength=128,g.prototype._digest=function(a){return"hex"===a?D.toHex32(this.h.slice(0,12),"big"):D.split32(this.h.slice(0,12),"big")},D.inherits(h,V),c.sha1=h,h.blockSize=512,h.outSize=160,h.hmacStrength=80,h.padLength=64,h.prototype._update=function(a,b){for(var c=this.W,d=0;d<16;d++)c[d]=a[b+d];for(;d<c.length;d++)c[d]=G(c[d-3]^c[d-8]^c[d-14]^c[d-16],1);for(var e=this.h[0],f=this.h[1],g=this.h[2],h=this.h[3],i=this.h[4],d=0;d<c.length;d++){var j=~~(d/20),k=J(G(e,5),p(j,f,g,h),i,c[d],Y[j]);i=h,h=g,g=G(f,30),f=e,e=k}this.h[0]=H(this.h[0],e),this.h[1]=H(this.h[1],f),this.h[2]=H(this.h[2],g),this.h[3]=H(this.h[3],h),this.h[4]=H(this.h[4],i)},h.prototype._digest=function(a){return"hex"===a?D.toHex32(this.h,"big"):D.split32(this.h,"big")}},{"../hash":19}],24:[function(a,b,c){function d(a,b){if(Array.isArray(a))return a.slice();if(!a)return[];var c=[];if("string"==typeof a)if(b){if("hex"===b){a=a.replace(/[^a-z0-9]+/gi,""),a.length%2!==0&&(a="0"+a);for(var d=0;d<a.length;d+=2)c.push(parseInt(a[d]+a[d+1],16))}}else for(var d=0;d<a.length;d++){var e=a.charCodeAt(d),f=e>>8,g=255&e;f?c.push(f,g):c.push(g)}else for(var d=0;d<a.length;d++)c[d]=0|a[d];return c}function e(a){for(var b="",c=0;c<a.length;c++)b+=h(a[c].toString(16));return b}function f(a){var b=a>>>24|a>>>8&65280|a<<8&16711680|(255&a)<<24;return b>>>0}function g(a,b){for(var c="",d=0;d<a.length;d++){var e=a[d];"little"===b&&(e=f(e)),c+=i(e.toString(16))}return c}function h(a){return 1===a.length?"0"+a:a}function i(a){return 7===a.length?"0"+a:6===a.length?"00"+a:5===a.length?"000"+a:4===a.length?"0000"+a:3===a.length?"00000"+a:2===a.length?"000000"+a:1===a.length?"0000000"+a:a}function j(a,b,c,d){var e=c-b;r(e%4===0);for(var f=new Array(e/4),g=0,h=b;g<f.length;g++,h+=4){var i;i="big"===d?a[h]<<24|a[h+1]<<16|a[h+2]<<8|a[h+3]:a[h+3]<<24|a[h+2]<<16|a[h+1]<<8|a[h],f[g]=i>>>0}return f}function k(a,b){for(var c=new Array(4*a.length),d=0,e=0;d<a.length;d++,e+=4){var f=a[d];"big"===b?(c[e]=f>>>24,c[e+1]=f>>>16&255,c[e+2]=f>>>8&255,c[e+3]=255&f):(c[e+3]=f>>>24,c[e+2]=f>>>16&255,c[e+1]=f>>>8&255,c[e]=255&f)}return c}function l(a,b){return a>>>b|a<<32-b}function m(a,b){return a<<b|a>>>32-b}function n(a,b){return a+b>>>0}function o(a,b,c){return a+b+c>>>0}function p(a,b,c,d){return a+b+c+d>>>0}function q(a,b,c,d,e){return a+b+c+d+e>>>0}function r(a,b){if(!a)throw new Error(b||"Assertion failed")}function s(a,b,c,d){var e=a[b],f=a[b+1],g=d+f>>>0,h=(g<d?1:0)+c+e;a[b]=h>>>0,a[b+1]=g}function t(a,b,c,d){var e=b+d>>>0,f=(e<b?1:0)+a+c;return f>>>0}function u(a,b,c,d){var e=b+d;return e>>>0}function v(a,b,c,d,e,f,g,h){var i=0,j=b;j=j+d>>>0,i+=j<b?1:0,j=j+f>>>0,i+=j<f?1:0,j=j+h>>>0,i+=j<h?1:0;var k=a+c+e+g+i;return k>>>0}function w(a,b,c,d,e,f,g,h){var i=b+d+f+h;return i>>>0}function x(a,b,c,d,e,f,g,h,i,j){var k=0,l=b;l=l+d>>>0,k+=l<b?1:0,l=l+f>>>0,k+=l<f?1:0,l=l+h>>>0,k+=l<h?1:0,l=l+j>>>0,k+=l<j?1:0;var m=a+c+e+g+i+k;return m>>>0}function y(a,b,c,d,e,f,g,h,i,j){var k=b+d+f+h+j;return k>>>0}function z(a,b,c){var d=b<<32-c|a>>>c;return d>>>0}function A(a,b,c){var d=a<<32-c|b>>>c;return d>>>0}function B(a,b,c){return a>>>c}function C(a,b,c){var d=a<<32-c|b>>>c;return d>>>0}var D=c,E=a("inherits");D.toArray=d,D.toHex=e,D.htonl=f,D.toHex32=g,D.zero2=h,D.zero8=i,D.join32=j,D.split32=k,D.rotr32=l,D.rotl32=m,D.sum32=n,D.sum32_3=o,D.sum32_4=p,D.sum32_5=q,D.assert=r,D.inherits=E,c.sum64=s,c.sum64_hi=t,c.sum64_lo=u,c.sum64_4_hi=v,c.sum64_4_lo=w,c.sum64_5_hi=x,c.sum64_5_lo=y,c.rotr64_hi=z,c.rotr64_lo=A,c.shr64_hi=B,c.shr64_lo=C},{inherits:27}],25:[function(a,b,c){"use strict";function d(a){if(!(this instanceof d))return new d(a);this.hash=a.hash,this.predResist=!!a.predResist,this.outLen=this.hash.outSize,this.minEntropy=a.minEntropy||this.hash.hmacStrength,this.reseed=null,this.reseedInterval=null,this.K=null,this.V=null;var b=f.toArray(a.entropy,a.entropyEnc||"hex"),c=f.toArray(a.nonce,a.nonceEnc||"hex"),e=f.toArray(a.pers,a.persEnc||"hex");g(b.length>=this.minEntropy/8,"Not enough entropy. Minimum is: "+this.minEntropy+" bits"),this._init(b,c,e)}var e=a("hash.js"),f=a("minimalistic-crypto-utils"),g=a("minimalistic-assert");b.exports=d,d.prototype._init=function(a,b,c){var d=a.concat(b).concat(c);this.K=new Array(this.outLen/8),this.V=new Array(this.outLen/8);for(var e=0;e<this.V.length;e++)this.K[e]=0,this.V[e]=1;this._update(d),this.reseed=1,this.reseedInterval=281474976710656},d.prototype._hmac=function(){return new e.hmac(this.hash,this.K)},d.prototype._update=function(a){var b=this._hmac().update(this.V).update([0]);a&&(b=b.update(a)),this.K=b.digest(),this.V=this._hmac().update(this.V).digest(),a&&(this.K=this._hmac().update(this.V).update([1]).update(a).digest(),this.V=this._hmac().update(this.V).digest())},d.prototype.reseed=function(a,b,c,d){"string"!=typeof b&&(d=c,c=b,b=null),a=f.toArray(a,b),c=f.toArray(c,d),g(a.length>=this.minEntropy/8,"Not enough entropy. Minimum is: "+this.minEntropy+" bits"),this._update(a.concat(c||[])),this.reseed=1},d.prototype.generate=function(a,b,c,d){if(this.reseed>this.reseedInterval)throw new Error("Reseed is required");"string"!=typeof b&&(d=c,c=b,b=null),c&&(c=f.toArray(c,d||"hex"),this._update(c));for(var e=[];e.length<a;)this.V=this._hmac().update(this.V).digest(),e=e.concat(this.V);var g=e.slice(0,a);return this._update(c),this.reseed++,f.encode(g,b)}},{"hash.js":19,"minimalistic-assert":28,"minimalistic-crypto-utils":26}],26:[function(a,b,c){"use strict";function d(a,b){if(Array.isArray(a))return a.slice();if(!a)return[];var c=[];if("string"!=typeof a){for(var d=0;d<a.length;d++)c[d]=0|a[d];return c}if("hex"===b){a=a.replace(/[^a-z0-9]+/gi,""),a.length%2!==0&&(a="0"+a);for(var d=0;d<a.length;d+=2)c.push(parseInt(a[d]+a[d+1],16))}else for(var d=0;d<a.length;d++){var e=a.charCodeAt(d),f=e>>8,g=255&e;f?c.push(f,g):c.push(g)}return c}function e(a){return 1===a.length?"0"+a:a}function f(a){for(var b="",c=0;c<a.length;c++)b+=e(a[c].toString(16));return b}var g=c;g.toArray=d,g.zero2=e,g.toHex=f,g.encode=function(a,b){return"hex"===b?f(a):a}},{}],27:[function(a,b,c){"function"==typeof Object.create?b.exports=function(a,b){a.super_=b,a.prototype=Object.create(b.prototype,{constructor:{value:a,enumerable:!1,writable:!0,configurable:!0}})}:b.exports=function(a,b){a.super_=b;var c=function(){};c.prototype=b.prototype,a.prototype=new c,a.prototype.constructor=a}},{}],28:[function(a,b,c){function d(a,b){if(!a)throw new Error(b||"Assertion failed")}b.exports=d,d.equal=function(a,b,c){if(a!=b)throw new Error(c||"Assertion failed: "+a+" != "+b)}},{}],29:[function(a,b,c){"use strict";function d(a,b){if(Array.isArray(a))return a.slice();if(!a)return[];var c=[];if("string"!=typeof a){for(var d=0;d<a.length;d++)c[d]=0|a[d];return c}if(b){if("hex"===b){a=a.replace(/[^a-z0-9]+/gi,""),a.length%2!==0&&(a="0"+a);for(var d=0;d<a.length;d+=2)c.push(parseInt(a[d]+a[d+1],16));
}}else for(var d=0;d<a.length;d++){var e=a.charCodeAt(d),f=e>>8,g=255&e;f?c.push(f,g):c.push(g)}return c}function e(a){return 1===a.length?"0"+a:a}function f(a){for(var b="",c=0;c<a.length;c++)b+=e(a[c].toString(16));return b}var g=c;g.toArray=d,g.zero2=e,g.toHex=f,g.encode=function(a,b){return"hex"===b?f(a):a}},{}],30:[function(a,b,c){b.exports={name:"elliptic",version:"6.4.0",description:"EC cryptography",main:"lib/elliptic.js",files:["lib"],scripts:{jscs:"jscs benchmarks/*.js lib/*.js lib/**/*.js lib/**/**/*.js test/index.js",jshint:"jscs benchmarks/*.js lib/*.js lib/**/*.js lib/**/**/*.js test/index.js",lint:"npm run jscs && npm run jshint",unit:"istanbul test _mocha --reporter=spec test/index.js",test:"npm run lint && npm run unit",version:"grunt dist && git add dist/"},repository:{type:"git",url:"git@github.com:indutny/elliptic"},keywords:["EC","Elliptic","curve","Cryptography"],author:"Fedor Indutny <fedor@indutny.com>",license:"MIT",bugs:{url:"https://github.com/indutny/elliptic/issues"},homepage:"https://github.com/indutny/elliptic",devDependencies:{brfs:"^1.4.3",coveralls:"^2.11.3",grunt:"^0.4.5","grunt-browserify":"^5.0.0","grunt-cli":"^1.2.0","grunt-contrib-connect":"^1.0.0","grunt-contrib-copy":"^1.0.0","grunt-contrib-uglify":"^1.0.1","grunt-mocha-istanbul":"^3.0.1","grunt-saucelabs":"^8.6.2",istanbul:"^0.4.2",jscs:"^2.9.0",jshint:"^2.6.0",mocha:"^2.1.0"},dependencies:{"bn.js":"^4.4.0",brorand:"^1.0.1","hash.js":"^1.0.0","hmac-drbg":"^1.0.0",inherits:"^2.0.1","minimalistic-assert":"^1.0.0","minimalistic-crypto-utils":"^1.0.0"}}},{}]},{},[1])(1)});
function token_units() { return 100000000 }; // VEO
function s2c(x) { return x / token_units(); }
function c2s(x) {
    return Math.floor(parseFloat(x.value, 10) * token_units());
}
function new_ss(code, prove, meta) {
    if (meta == undefined) {
        meta = 0;
    }
    return {"code": code, "prove": prove, "meta": meta};
}
function new_cd(me, them, ssme, ssthem, expiration, cid) {
    return {"me": me, "them": them, "ssme": ssme, "ssthem": ssthem, "cid":cid, "expiration": expiration};
}
function big_array_to_int(l) {
    //var x = 0n;
    var x = 0;
    for (var i = 0; i < l.length; i++) {
        //x = (x.times(256)).plus(l[i]);
        //x = (256n * x) + BigInt(l[i]);
        x = 0;
    }
    return x;
}
function array_to_int(l) {
    var x = 0;
    for (var i = 0; i < l.length; i++) {
        x = (256 * x) + l[i];
    }
    return x;
}
function toHex(str) {
    var hex = '';
    for(var i=0;i<str.length;i++) {
        l = str.charCodeAt(i).toString(16);
        var z = "";
        if (l.length < 2) { z = "0"; }
        hex += z;
	hex += ''+str.charCodeAt(i).toString(16);
    }
    return hex;
}
function fromHex(h) {
    var s = '';
    for(var i = 0; (2*i) < h.length;i++) {
        var m = h.slice((2*i), (2*(i+1)));
        var n = parseInt(m, 16);
        var l = String.fromCharCode(n);
        s = s.concat(l);
    }
    return s;
}
function string_to_array(x) {
    var a = new Uint8Array(x.length);
    for (var i=0; i<x.length; i++) {
        a[i] = x.charCodeAt(i);
    }
    return Array.from(a);
}
function big_integer_to_array(i, size) {
    var a = [];
    for ( var b = 0; b < size ; b++ ) {
        //var j = ((i % 256n) + 256n) % 256n;
        //var j =((i % 256n) + 256n) % 256n;
        var j = 0;
        //console.log(j);
        a.push(parseInt(j.toString()));
        //a.push(((i % 256n) + 256n) % 256n);
        //i = i / 256n;
        i = 0;//i / 256n;
        //a.push(i.remainder(256).plus(256).remainder(256));
        //i = i.divide(256);
        //a.push(((i % 256) + 256) % 256);
        //i = Math.floor(i/256);
    }
    return a.reverse();
}
function integer_to_array(i, size) {
    var a = [];
    for ( var b = 0; b < size ; b++ ) {
        a.push(((i % 256) + 256) % 256);
        i = Math.floor(i/256);
    }
    return a.reverse();
}
function array_to_string(x) {
    var a = "";
    for (var i=0; i<x.length ; i++) {
        a += String.fromCharCode(x[i]);
    }
    return a;
}
function hash2integer(h) {
    function hash2integer2(h, i, n) {
        var x = h[i];
        if  ( x == 0 ) {
            return hash2integer2(h, i+1, n+(256*8));
        } else {
            return n + hash2integer3(x, h[i+1]);
        }
    }
    function dec2bin(dec){
        n = (dec).toString(2);
        n="00000000".substr(n.length)+n;
        return n;
    }
    function hash2integer3(byte1, byte2) {
        var x = dec2bin(byte1).concat(dec2bin(byte2));
        return hash2integer4(x, 0, 0);
    }
    function hash2integer4(binary, i, n) {
        var x = binary[i];
        if ( x == "0" ) { return hash2integer4(binary, i+1, n+256) }
        else {
            var b2 = binary.slice(i, i+8);
            var y = hash2integer5(b2) + n;
            return y;
        }
    }
    function hash2integer5(bin) {
        var x = 0;
        for (var i=0; i < bin.length; i++) {
            var y = bin[i];
            if ( y == "0" ) { x = x * 2; }
            else { x = 1 + (x * 2) }
        }
        return x;
    }
    return hash2integer2(h.concat([255]), 0, 0);
}
function newhash2integer(h) {
    function hash2integer2(h, i, n) {
        var x = h[i];
        if  ( x == 0 ) {
            return hash2integer2(h, i+1, n+(256*8));
        } else {
            return n + hash2integer3(x, h[i+1]);
        }
    }
    function dec2bin(dec){
        n = (dec).toString(2);
        n="00000000".substr(n.length)+n;
        return n;
    }
    function hash2integer3(byte1, byte2) {
        var x = dec2bin(byte1).concat(dec2bin(byte2));
        return hash2integer4(x, 0, 0);
    }
    function hash2integer4(binary, i, n) {
        var x = binary[i];
        if ( x == "0" ) { return hash2integer4(binary, i+1, n+256) }
        else {
            var b2 = binary.slice(i+1, i+9);//this is the only line that is different between hash2integer and newhash2integer
            var y = hash2integer5(b2) + n;
            return y;
        }
    }
    function hash2integer5(bin) {
        var x = 0;
        for (var i=0; i < bin.length; i++) {
            var y = bin[i];
            if ( y == "0" ) { x = x * 2; }
            else { x = 1 + (x * 2) }
        }
        return x;
    }
    
    return hash2integer2(h.concat([255]), 0, 0);
}
function button_maker2(val, fun) {
    var button = document.createElement("input");
    button.type = "button";
    button.value = val;
    button.onclick = fun;
    return button;
};
function br() {
    return document.createElement("br");
};
function append_children(d, l) {
    for (var i = 0; i < l.length; i++) {
        d.appendChild(l[i]);
    }
}
function text(a) {
    var x2 = document.createElement("h8");
    x2.innerHTML = a;
    return x2;
};
function text_input(query, div) {
    var x = document.createElement("INPUT");
    x.type = "text";
    var q = text(query);
    div.appendChild(q);
    div.appendChild(x);
    return x;
};
function load_selector_options(selector, L) {
    if(L.length < 1) {
        return(0);
    };
    var option = document.createElement("option");
    option.innerHTML = L[0];
    option.value = L[0];
    selector.appendChild(option);
    var L2 = L.slice(1);
    load_selector_options(selector, L2);
};


function tree_number_to_value(t) {
    if (t < 101) {
        return t;
    } else {
        var top = 101;
        var bottom = 100;
	var t2 = t - 100;
        var x = tree_number_det_power(10000, top, bottom, t2);
        return Math.floor(x / 100);
    }
}
function tree_number_det_power(base, top, bottom, t) {
    if (t == 1) {
        return Math.floor((base * top) / bottom);
    }
    var r = Math.floor(t % 2);
    if (r == 1) {
        var base2 = Math.floor((base * top) / bottom);
        return tree_number_det_power(base2, top, bottom, t-1);
    } else if (r == 0) {
        var top2 = Math.floor((top * top)  / bottom);
        return tree_number_det_power(base, top2, bottom,
                                     Math.floor(t / 2));
    }
}
function parse_address(A) {
    //remove spaces or periods. " " "."
    A2 = A.trim();
    A3 = A2.replace(/\./g,'');
    //if it is the wrong length, make an error.
    //88
    B = ((A3).length == 88);
    if (B) { return A3; } else { return 0; };
}

function read_veo(X) {
    return Math.floor(parseFloat(X.value, 10) * token_units());
}

function fee_checker(address, Callback1, Callback2) {
    rpc.post(["account", address],
			function(result) {
			    if ((result == 0) || (result == "empty")) {
				merkle.request_proof("governance", 14, function(gov_fee) {
				    var fee = tree_number_to_value(gov_fee[2]) + 50;
				    Callback1(fee);
				   });
			    } else {
				merkle.request_proof("governance", 15, function(gov_fee) {
				    var fee = tree_number_to_value(gov_fee[2]) + 50;
				    Callback2(fee);
				});
			    }});
};

function send_encrypted_message(imsg, to, callback) {
    var emsg = keys.encrypt(imsg, to);
    rpc.messenger(["account", keys.pub()], function(account) {
        //console.log("account is ");
        //console.log(JSON.stringify(account));
        var nonce = account[3] + 1;
        //nonce = 0;//look up nonce from account, add 1 to it.
        //var r = [53412, keys.pub(), nonce, emsg];
        var r = [-7, 53412, keys.pub(),nonce,emsg];
        //console.log(JSON.stringify(r));
        var sr = keys.sign(r);
        //console.log("check signature");
        //console.log(verify1(sr));
        return rpc.messenger(["send", 0, to, sr], function(x) {
            return callback();
        });
    });
};
/*
function verify_exists(oid, n, callback) {
    //console.log(oid);
    if (n == 0) {
        return callback();
    }
    return merkle.request_proof("oracles", oid, function(x) {
        var result = x[2];
        if (!(result == 0)) {
            status.innerHTML = "status: <font color=\"red\">Error: That oracle does not exist.</font>";
            return 0;
        };
        return verify_exists(btoa(next_oid(atob(oid))), n-1, callback);
    });
};
*/
function random_cid(n) {
    if (n == 0) { return ""; }
    else {
        var rn = Math.floor(Math.random() * 256);
        var rl = String.fromCharCode(rn);
        return rl.concat(random_cid(n-1))}
};

/*
function next_oid(oid) {
    //oid starts in binary format. we want to add 1 to the binary being encoded by oid.
    var ls = oid[oid.length - 1];
    var n = ls.charCodeAt(0);
    if (n == 255) {
        return next_oid(oid.slice(0, oid.length - 1)).concat(String.fromCharCode(0));
    }
    return oid.slice(0, oid.length - 1).concat(String.fromCharCode(n+1));
};
*/





function pd_maker(height, price, portion, oid) {
    //PD = <<Height:32, Price:16, PortionMatched:16, MarketID/binary>>,
    var a = make_bytes(4, height);
    var b = make_bytes(2, price);
    var c = make_bytes(2, portion);
    var d = atob(oid);
    return a.concat(b).concat(c).concat(d);
}
function make_bytes(bytes, b) {
    if (bytes == 0) {
        return "";
    } else {
        var r = b % 256;
        var d = Math.floor(b / 256);
        var l = String.fromCharCode(r);
        var t = make_bytes(bytes - 1, d);
        return t.concat(l);
    }
};

    
function oracle_limit(oid, callback) {
    return rpc.post(["oracle", oid], function(x) {
        var question = atob(x[2]);
        //console.log(question);
        //measured_upper.value = (largest_number(question, 0, 0)).toString();
        return callback(oracle_limit_grabber(question));
    });
    function oracle_limit_grabber(question) {
        console.log("oracle limit grabber");
        if (question.length < 4) {
            return "";
        }
        var f = question.slice(0, 4);
        if (f == "from") {
            return olg2(question.slice(4));
        }
        return oracle_limit_grabber(question.slice(1));
    }
    function olg2(question) {
        //console.log("olg2");
        //console.log(question);
        if (question.length < 2) {
            return "";
        }
        var f = question.slice(0, 2);
        if (f == "to") {
            //console.log("calling olg3 ");
            return olg3(question.slice(2), "");
        }
        return olg2(question.slice(1));
    }
    function olg3(question, n) {
        //console.log(n);
        if (question.length < 1) { return n; }
        var l = question[0];
        if (((l >= "0") && (l <= "9")) || (l == ".")) {
            var n2 = n.concat(l);
            return olg3(question.slice(1), n2);
        } else if (n == "") {
            return olg3(question.slice(1), n);
        } else {
            return n;
        }
    };
};



function check_spk_sig(pub, ch, sig) {
    //console.log("format check spk sig");
    //console.log(JSON.stringify([ch, sig, pub]));
    var our_key =  keys.ec().keyFromPublic(toHex(atob(pub)), "hex");
    return verify(ch, sig, our_key);
}
function spk_sig(x) {
    if (x[0] == "spk") {
        //console.log("format spk sig");
        //console.log(JSON.stringify(x));
        x = btoa(array_to_string(hash(serialize(x))));
    }
    var sig1 = sign(x, keys.keys_internal());
    return btoa(array_to_string(sig1));
};
function encode_cid(cid, pub) {
    var top_header = headers_object.top();
    var blockheight = top_header[1];
    //var f29 = 104600;
    var f29 = headers_object.forks.twenty_nine;
    if (blockheight > f29){//fork 29
        return(btoa(array_to_string(hash(string_to_array(atob(cid)).concat(string_to_array(atob(pub)))))));
    }else{
        return(cid);
    };
};
function derivatives_load_db(y) {
    //console.log(JSON.stringify(y));
    var db = {};
    db.direction_val = y[1];
    db.expires = y[2];
    db.maxprice = y[3];
    db.acc1 = y[4];
    db.acc2 = y[5];
    //if (!(keys.pub() == db.acc2)) {
    //   console.log("wrong address");
    //  return 0;
    // }
    db.period = y[6];
    db.amount1 = y[7];
    db.amount2 = y[8];
    //console.log(db.amount2);
    db.oid = y[9];
    db.height = y[10];
    db.delay = y[11];
    db.contract_sig = y[12];
    db.spd = atob(y[13]);
    db.spk_nonce = y[14];
    db.oracle_type_val = y[15];
    db.oracle_type;
    db.cid = y[16];
    db.payment = y[20];
    if (db.oracle_type_val == 2) {
        db.oracle_type = "scalar";
        db.bits = y[17];
        db.upper_limit = y[18];
        db.lower_limit = y[19];
        db.knowable = y[22];
    } else if (db.oracle_type_val == 1) {
        db.oracle_type = "binary";
        //db.maxprice = 1;
        }
    if (db.direction_val == 1) {
        db.direction = "false or short or long-veo";
    } else if (db.direction_val == 2) {
        db.direction = "true or long or stablecoin";
        }
    //console.log("display trade");
    return db;
};
function default_period() {
    return 1000000;
}
function spk_maker(db, acc2, amount, period) {
    //console.log("spk maker amount ");
    //console.log(amount);
    //var period = 10000000;//only one period because there is only one bet.
    //var amount = db.amount1 + db.amount2;
    var sc;
    if (db.oracle_type == "scalar") {
        console.log("creating contract");
        console.log(JSON.stringify(db));
        //var activates = db.oracle[4];
        var activates = db.knowable;
        console.log(activates);
        sc = scalar_market_contract(db.direction_val, db.expires, db.maxprice, db.acc1, period, amount, db.oid, db.height, db.lower_limit, db.upper_limit, db.bits, activates);
    } else if (db.oracle_type == "binary") {
        sc = market_contract(db.direction_val, db.expires, db.maxprice, db.acc1, period, amount, db.oid, db.height);
    }
    //var delay = 1000;//a little over a week
    var spk = ["spk", db.acc1, acc2, [-6], 0,0,db.cid, 0,0,db.delay];
    var cd = new_cd(spk, [],[],[],db.expires, db.cid);
    //console.log(JSON.stringify(spk));
    //console.log(JSON.stringify(sc));
    //console.log("format spk maker before market trade");
    //console.log(amount);//2 veo
    //console.log(db.maxprice);//5000 //if this was 0, it would probably fix it.
    return market_trade(cd, amount, db.maxprice, sc, db.oid);
};
function scalar_to_prove2(ks) {
    return (ks).map(function(x) {
        return(["oracles", x]);
    });
};
//function scalar_to_prove(oid, start) {
//    var ks = scalar_keys(oid, start);
//    console.log(JSON.stringify(ks));
//    return scalar_to_prove2(ks);
//};
    
    //if (n == 0) { return []; }
    //var noid = btoa(next_oid(atob(oid)));
    //var rest = scalar_to_prove(noid, n-1);
    //return [["oracles", oid]].concat(rest);
//};
function rcs_to_prove(otv, oid, callback) {
    var to_prove;
    if (otv == 2) {//scalar
        return(scalar_keys1(oid, function(ks) {
            console.log(JSON.stringify(ks));
            to_prove = [-6].concat(scalar_to_prove2(ks));
            return(callback(to_prove));
        }));
    } else if (otv == 1){//binary
        to_prove = [-6, ["oracles", oid]];
        return(callback(to_prove));
    }
};
    
function record_channel_state(sspk2, db, acc2, callback) {
    var meta = 0;
    return(rcs_to_prove(
        db.oracle_type_val,
        db.oid,
        function(to_prove) {
            var spd_bytes = string_to_array(db.spd);
            var size = spd_bytes.length;
            var size_a = Math.floor(size / 256);
            var size_b = size % 256;
            var code = [2,0,0,size_a,size_b].concat(spd_bytes).concat([0,0,0,0,1]);
            var ss = new_ss(code, to_prove, meta);
            var expiration = 10000000;
            var cd = new_cd(sspk2[1], sspk2, [ss], [ss], expiration, db.cid);
            var nacc;
            if (db.acc1 == keys.pub()) {
                nacc = acc2;
                //channels_object.write(acc2, cd);
            } else {
                nacc = db.acc1;
                //channels_object.write(db.acc1, cd);
            };
            return(callback(cd, nacc));
        }));
};


function id_maker(start, gov1, gov2, question) {
    if (question.length > 999) {
        console.log("question is too long");
        return "question too long";
    }
    var x = integer_to_array(start, 4).concat
    (integer_to_array(gov1, 4)).concat
    (integer_to_array(gov2, 4)).concat
    (hash(string_to_array(question)));
    return(btoa(array_to_string(hash(x))));//is array
};
function question_maker(id, bit) {
    if (bit < 1) {return 0;}
    if (bit > 9) {return 0;}
    return("scalar ".concat
           (id).concat
           (" bit number ").concat
           ((bit).toString()));
}
function scalar_keys2(id, start, I, out) {
    if (I == 10) {return out;}
    var QN = question_maker(id, I);
    console.log("question maker");
    console.log(JSON.stringify(QN));
    var id2 = id_maker(start, 0, 0, QN);
    //console.log(btoa(id2));
    return scalar_keys2(id, start, I+1, [id2].concat(out));
};
function scalar_keys(id, start) {
    return scalar_keys2(id, start, 1, [id]).reverse();
};
function scalar_keys1(id, callback) {
    merkle.request_proof("oracles", id, function(Oracle) {
        var starts = Oracle[4];
        console.log("scalar keys 1 oracle starts is ");
        console.log(starts);
        console.log(id);
        return callback(scalar_keys(id, starts));
    });
};

function post_txs(txs, callback) {
    rpc.post(["txs", [-6].concat(txs)],
             function(x) {
                 if(x == "ZXJyb3I="){
                     callback(-1);
                 }else{
                     callback(x);
                 }
             });
};

var rpc = (function() {
    function url(port, ip) {
        return "http://".concat(ip).concat(":").
            concat(port.toString()).concat("/"); }
    function messenger(cmd, callback){
        var u = url(8088, get_ip());
        return talk(cmd, u, callback, 10000);
    };
    function default_explorer(cmd, callback) {
        var u = "http://159.89.87.58:8090/";
        return talk(cmd, u, callback, 10000);
    };
    function main(cmd, callback, ip, port) {
        if (ip == undefined){
            ip = get_ip();
        }
        if (port == undefined){
            port = get_port();
        }
        var u = url(port, ip);
        return talk(cmd, u, callback, 10000);//use up to 10 seconds for this request
    }
    function talk(cmd, u, callback, n) {
        var xmlhttp=new XMLHttpRequest();
        xmlhttp.open("POST",u,true);
        xmlhttp.send(JSON.stringify(cmd));
        return listen(xmlhttp, cmd, u, callback, n);
    };
    var verbose = false;
    function listen(x, cmd, u, callback, n) {
        if (n < 1) { return "failed to connect"; }
        else if (x.status == 400) {
            if(verbose){ console.log("data sent to server got mixed up and looks invalid. attempting to re-send");}
            setTimeout(function() {
                return talk(cmd, u, callback, n - 100);
            }, 100); }
        else if (x.status == 0) {
            if(verbose){ console.log("the server got our message and is processing a response. lets wait a bit for the response");}
            setTimeout(function() {
                return listen(x, cmd, u, callback, n - 20);
            }, 20);
        }
        else if (x.readyState == 3) {
            if(verbose){ console.log("currently receiving a response. lets wait a bit for the rest of the data to arrive"); };
            setTimeout(function() {return listen(x, cmd, u, callback, n-10);}, 10);
        }
        else if ((x.readyState === 4) && (x.status === 200)) {
            if(verbose){ console.log("received a response from the server.");}
            p = JSON.parse(x.responseText);
            return callback(p[1]);
        }
        else {
            console.log(x.readyState);
            console.log(x.status);
            if(verbose){console.log("unhandled state. wait a bit and hopefully it ends.");}
            setTimeout(function() {return listen(x, cmd, u, callback, n-50);}, 50);}
    };
    return {post: main,
            default_explorer: default_explorer,
            messenger: messenger};
})();

function download(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
            url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}

/** @fileOverview Bit array codec implementations.
 *
 * @author Emily Stark
 * @author Mike Hamburg
 * @author Dan Boneh
 */
/**
 * Arrays of bytes
 * @namespace
 */
sjcl.codec.bytes = {
    /** Convert from a bitArray to an array of bytes. */
    fromBits: function (arr) {
        var out = [], bl = sjcl.bitArray.bitLength(arr), i, tmp;
        for (i=0; i<bl/8; i++) {
            if ((i&3) === 0) {
                tmp = arr[i/4];
            }
            out.push(tmp >>> 24);
            tmp <<= 8;
        }
        return out;
    },
    /** Convert from an array of bytes to a bitArray. */
    toBits: function (bytes) {
        var out = [], i, tmp=0;
        for (i=0; i<bytes.length; i++) {
            tmp = tmp << 8 | bytes[i];
            if ((i&3) === 3) {
                out.push(tmp);
                tmp = 0;
            }
        }
        if (i&3) {
            out.push(sjcl.bitArray.partial(8*(i&3), tmp));
        }
        return out;
    }
};

function hash(input) {//array of bytes -- array of bytes
    var b = sjcl.codec.bytes.toBits(input);
    var x = sjcl.hash.sha256.hash(b);
    return sjcl.codec.bytes.fromBits(x);
}

function merkle_proofs_main() {
    function verify_callback(tree, key, callback) {
	var top_hash = hash(headers_object.serialize(headers_object.top()));
	rpc.post(["proof", btoa(tree), key, btoa(array_to_string(top_hash))], function(proof){
            if ((proof[3] == "empty")||(proof[3]==0)) { return callback("empty"); };
	    var val = verify_merkle(key, proof);
	    return callback(val);
	    
	});
    }
    function hash_member(hash, members) {
        for (var i = 0; i < members.length; i++) {
            var h2 = members.slice(32*i, 32*(i+1));
            //console.log("check that hash is a member");
            var b = check_equal(hash, h2);
            if (b) { return true; }
        }
        return false;
    }
    function check_equal(a, check_b) {
        for (var i = 0; i < a.length; i++) {
            if (!(a[i] == check_b[i])) {
                return false
            }
        }
        return true;
    }
    function link_hash(l) {
        var h = [];
        for (var i = 1; i < l.length; i++) {
            //console.log(link[i]);
            var x = string_to_array(atob(l[i]));
            h = x.concat(h);
        }
        return hash(h);
    }
    function chain_links(chain) {
        var out = true;
        for (var i = 1; i < chain.length; i++) {
            var parent = chain[i-1];
            var child = chain[i];
            var lh = link_hash(child);
            var chain_links_b = chain_links_array_member(parent, lh);
            if (chain_links_b == false) {
                return false;
            }
            //out = out && chain_links_array_member(parent, lh);
        }
        return true;
    }
    function chain_links_array_member(parent, h) {
        for (var i = 1; i < parent.length; i++) {
            var x = parent[i];
            var p = string_to_array(atob(x));
            var b = check_equal(p, h);
            if (b) { return true; }
        }
        return false;
    }
    function leaf_hash(v, trie_key) {
        var serialized =
            serialize_key(v, trie_key).concat(
                serialize_tree_element(v, trie_key));
        return hash(serialized);
    }
    function verify_merkle(trie_key, x) {
    //x is {return tree_roots, tree_root, value, proof_chain}
	var tree_roots = string_to_array(atob(x[1]));
	var header_trees_hash = string_to_array(atob(headers_object.top()[3]));
	var hash_tree_roots = hash(tree_roots);
	var check = check_equal(header_trees_hash, hash_tree_roots);
	if (!(check)) {
            console.log("the hash of tree roots doesn't match the hash in the header.");
	} else {
            var tree_root = string_to_array(atob(x[2]));
            var check2 = hash_member(tree_root, tree_roots);
            if (!(check2)) {
		console.log("that tree root is not one of the valid tree roots.");
            } else {
		var chain = x[4].slice(1);
		chain.reverse();
		var h = link_hash(chain[0]);
		var check3 = check_equal(h, tree_root);
		var check4 = chain_links(chain);
		if (!(check3)) {
                    console.log("the proof chain doesn't link to the tree root");
		} else if (!(check4)){
                    console.log("the proof chain has a broken link");
		} else {
                    var last = chain[chain.length - 1];
                    var value = x[3];
                    var lh = leaf_hash(value, trie_key);
                    var check5 = chain_links_array_member(last, lh);
                    if (check5) {
			return value;
			//we should learn to deal with proofs of empty data.
                    } else {
			console.log(JSON.stringify(x));
			console.log(trie_key);
                        console.log(value);
			console.log("the value doesn't match the proof");
                        return("fail");
			//throw("bad");
                    }
		}
            }
	}
    }
    function serialize_key(v, trie_key) {
	var t = v[0];
	if ( t == "gov" ) {
            return integer_to_array(trie_key, 8);
	} else if ( t == "acc" ) {
            //console.log("v is ");
            //console.log(v);
            var pubkey = string_to_array(atob(v[3]));
            return hash(pubkey);
	} else if ( t == "sub_acc" ) {
            //pub, cid, type:256
            return(sub_accounts.key(v[3], v[4], v[5]));
	} else if ( t == "market" ) {
            return(string_to_array(atob(v[1])));
	} else if ( t == "contract" ) {
            //code, source, many_types, source_types
            return(hash(string_to_array(atob(id_maker(v[1], v[2], v[8], v[9])))));
	} else if ( t == "channel" ) {
            //return hash(integer_to_array(v[1], 32));
            return hash(string_to_array(atob(v[1])));
	} else if (t == "oracle") {
            //return hash(integer_to_array(v[1], 32));
            return hash(string_to_array(atob(v[1])));
        } else if (t == "unmatched") {
            //console.log("serialize_key unmatched ");
            if (v[2] == "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=") {//unmatched header
                var account = trie_key[1];
                var oid = trie_key[2];
                return hash(string_to_array(atob(account)).concat(string_to_array(atob(oid))));
            }
            return hash(string_to_array(atob(v[1])).concat(string_to_array(atob(v[2]))));
	} else {
            console.log("type is ");
            console.log(t);
            console.log(v);
            throw("serialize trie bad trie type");
	}
    }
    function serialize_tree_element(v, trie_key) {
	//console.log("serialize tree element");
	//console.log(JSON.stringify(v));
	//console.log(trie_key);
	var t = v[0];
	if ( t == "gov" ) {
            var id = integer_to_array(v[1], 1);
            var value = integer_to_array(v[2], 2);
            var lock = integer_to_array(v[3], 1);
            var serialized = ([]).concat(
		id).concat(
                    value).concat(
			lock);
            return serialized;
        } else if ( t == "unmatched" ) {
            if (v[2] == "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=") {//unmatched header
                //32+65+6 = 103
                var many = array_to_int(string_to_array(atob(v[4])));
                var serialized = string_to_array(atob(v[1])).concat(integer_to_array(many, 103));
                return serialized;
            }
                
            var pubkey = string_to_array(atob(v[1]));
            var oracle = string_to_array(atob(v[2]));
            var amount = integer_to_array(v[3], 6);
            var pointer = string_to_array(atob(v[4]));
            var serialized = ([]).concat(
                pubkey).concat(
                    oracle).concat(
                        amount).concat(
                            pointer);
            //console.log(JSON.stringify([pubkey, oracle, amount, pointer, serialized]));
            return serialized;
            
	} else if ( t == "acc" ) {
            var balance = integer_to_array(v[1], 6);
            var nonce = integer_to_array(v[2], 3);
            var pubkey = string_to_array(atob(v[3]));
            var bets = string_to_array(atob(v[5]));
            var serialized = ([]).concat(
		balance).concat(
                    nonce).concat(
			pubkey).concat(
                            bets);
            return serialized;
	} else if ( t == "sub_acc" ) {
            var balance = integer_to_array(v[1], 6);
            var nonce = integer_to_array(v[2], 3);
            var pubkey = string_to_array(atob(v[3]));
            var cid = string_to_array(atob(v[4]));
            var type = integer_to_array(v[5], 4);
            var serialized = ([])
                .concat(balance)
                .concat(nonce)
                .concat(type)
                .concat(pubkey)
                .concat(cid);
            return serialized;
	} else if ( t == "market" ) {
            var id = string_to_array(atob(v[1]));
            var cid1 = string_to_array(atob(v[2]));
            var type1 = integer_to_array(v[3], 2);
            var amount1 = integer_to_array(v[4], 6);
            var cid2 = string_to_array(atob(v[5]));
            var type2 = integer_to_array(v[6], 2);
            var amount2 = integer_to_array(v[7], 6);
            var shares = integer_to_array(v[8], 6);
            return([])
                .concat(id)
                .concat(cid1)
                .concat(cid2)
                .concat(type1)
                .concat(type2)
                .concat(amount1)
                .concat(amount2)
                .concat(shares);
	} else if ( t == "contract" ) {
            var code = string_to_array(atob(v[1]));
            var result = string_to_array(atob(v[7]));
            var source = string_to_array(atob(v[8]));
            var sink = string_to_array(atob(v[10]));
            var sourcetype = integer_to_array(v[9], 2);
            var volume = integer_to_array(v[11], 6);
            var many = integer_to_array(v[2], 2);
            var nonce = integer_to_array(v[3], 4);
            var last_modified = integer_to_array(v[4], 4);
            var delay = integer_to_array(v[5], 4);
            var closed = integer_to_array(v[6], 1);
            return ([])
                .concat(code)
                .concat(result)
                .concat(source)
                .concat(sink)
                .concat(sourcetype)
                .concat(many)
                .concat(nonce)
                .concat(last_modified)
                .concat(delay)
                .concat(closed)
                .concat(volume);
	} else if ( t == "channel" ) {
            //var cid = integer_to_array(v[1], 32);
            var cid = string_to_array(atob(v[1]));
            var acc1 = string_to_array(atob(v[2]));
            var acc2 = string_to_array(atob(v[3]));
            var bal1 = integer_to_array(v[4], 6);
            var bal2 = integer_to_array(v[5], 6);
            var hb = 140737488355328;
            var amount = integer_to_array(hb + v[6] , 6);
            //var amount = integer_to_array(128, 1).concat(
		//integer_to_array(v[6], 5));
            var nonce = integer_to_array(v[7], 4);
            var last_modified = integer_to_array(v[8], 4);
            var delay = integer_to_array(v[9], 4);
            var closed = integer_to_array(v[11], 1);
            var serialized = ([])
                .concat(cid)
                .concat(bal1)
                .concat(bal2)
                .concat(amount)
                .concat(nonce)
                .concat(last_modified)
                .concat(delay)
                .concat(closed)
                .concat(acc1)
                .concat(acc2);
            return serialized;
	} else if (t == "oracle") {
            //var id = integer_to_array(v[1], 32);
            //var id = string_to_array(v[1], 32);
	    //console.log("serialize oracle ");
	    //console.log(JSON.stringify(v));
            var id = string_to_array(atob(v[1]));
            var result = integer_to_array(v[2], 1);
            var type = integer_to_array(v[5], 1);
            var starts = integer_to_array(v[4], 4); 
            var done_timer = integer_to_array(v[9], 4); //height_bits/8 bytes
            var governance = integer_to_array(v[10], 1); //one byte
            var governance_amount = integer_to_array(v[11], 1); //one byte
            var creator = string_to_array(atob(v[8])); //pubkey size
            var question = string_to_array(atob(v[3])); //32 bytes size
            var orders = string_to_array(atob(v[7])); //32 bytes
            //var serialized = integer_to_array(v[1], 256).concat(
            var serialized = ([]).concat(
		id).concat(
                    result).concat(
			type).concat(
                            starts).concat(
				done_timer).concat(
                                    governance).concat(
					governance_amount).concat(
                                            creator).concat(
						question).concat(
                                                    orders);
	    //console.log("serialized oracle");
	    //console.log(JSON.stringify(serialized));
            return serialized;
	} else {
            console.log("cannot decode type ");
            console.log(t);
	}
    }
    function test() {
	verify_callback("governance", 14, function(fun_limit) {
	    console.log("merkle proof test result is: ");
	    console.log(fun_limit);
	});
	verify_callback("oracles", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", function(fun_limit) {
	    console.log("merkle proof test result is: ");
	    console.log(fun_limit);
	});
    }
    function id_maker(
        contract_hash, many_types,
        source_id, source_type)
    {
        //for contracts
        if(!(source_id)){
            source_id = btoa(array_to_string(integer_to_array(0, 32)));
            source_type = 0;
        };
        var to_hash = 
            string_to_array(atob(contract_hash))
            .concat(string_to_array(atob(source_id)))
            .concat(integer_to_array(many_types, 2))
            .concat(integer_to_array(source_type, 2));
        return(btoa(array_to_string(hash(to_hash))));
    };
    return {request_proof: verify_callback,
	    verify: verify_merkle,
	    serialize: serialize_tree_element,
	    serialize_key: serialize_key,
            contract_id_maker: id_maker,
	    test: test};
}
var merkle = merkle_proofs_main();


//CUSTOM

var SERVER_PORT;
var SERVER_IP;

function get_port() {
    return parseInt(SERVER_PORT, 10);
}
function get_ip() {
    return SERVER_IP;
}

function headers_main() {
	var mode = "production";
    var forks;
    var retarget_frequency;
    var top_header;
    var headers_db = {};//store valid headers by hash
    var INITIAL_DIFFICULTY;
    var headers_batch = 5000;
    if (mode == "test") {
	//INITIAL_DIFFICULTY = 2500;
	INITIAL_DIFFICULTY = 10;
	retarget_frequency = 12;
	forks = {two: 0, four: 0,//retarget_frequency,
                 seven:40, twenty_nine:0};
	top_header = 0;
    } else if (mode == "testnet") {
	INITIAL_DIFFICULTY = 2500;
	retarget_frequency = 12;
	forks = {two: 0, four: retarget_frequency, seven:40, twenty_nine:0};
        top_header = ["header",10000,"PzAka1LatHpj7zhwY098sM9XaE4Vv+stjmUMWB21Md8=","9169gcVs1KQ/Kvcf0bRkeZfsjAjQ56kdlrwr3auML7Y=","JMgF+lUkTB2r37qrGG1B2SiS2h/bjdUO72jItcXdXLY=",304286457,6159,0,"AAAAAAAAAAAAFtXjnSwuMUTSTMmhbVNcvjZY3xZXv08=",230706923204,746];
        write_header(top_header, 21003884);


        //top_header = ["header",10932,"9tbLYW739Zw6/9FGUKpOJvemE+B1gtuHVLfWgdkBxGk=","XRLDP/0XKIvdNHTCj6iq34rmnh8X1Z1n++aqWY2GnOU=","ogV1t76d8+gLhOvJMU/Fx5S0z41KT4PDhPbCYROTXlE=",315668237,2500,0,"AAAAAAAAAAAAOP8UeJxxD4DZQEahh3OQkKcQ2tbHFuU=",249808154332,746]
        //write_header(top_header, 1);
	//top_header = ["header",50,"avmTCvhW62I5b1ZKW/k+hN5VkDTRBUfNOML1IbDeBEM=","HtCW+xejEr+hVx9EU/YWqjkToHfB65LznX/7kYY1qYc=","/nky29gffL519fIShxYtlGYrSl/VvYYSw0Qk2F/+Q4k=",283297347,4861,0,"AAAAAAAAAAAAoAC51HYeqD+RjyH1Ew1tdebVT3/BD6g=",1006239072,746];
	//write_header(top_header, 713104);
    } else {
	INITIAL_DIFFICULTY = 8844;
	retarget_frequency = 2000;
	forks = {two: 9000, four: 26900, seven:28135, twenty_nine:104600};
	//top_header = 0;
        //top_header = ["header",75963,"Hlp6dHOmI8MLSKoszxuU840fqrlm/5yuqJR92Idg9oU=","hudw3ucSvaEsFwH+zlxOUZ7KC0MNdnTimhWk6OPfQN8=","KJc9pvOIj7867XK/u7WL71gNQLNMn5pA+dUATaGrxuw=",453614702,13227,3,"AAAAAAAAAAAAp97vT1xPju+8EwiRULi0U/gliqEAAAA=",1656017740603758477312,5982];
        //top_header = ["header", 115963, "eMIChQ5lvwYTBsmuU+PSGfJ+yk7JHmUiDmJ05PWlUiY=", "rGvO+mDwjUMXhuM2SVZjhEoEBg8mhYcooUAHWgHG/TY=", "87WiCyA+8TwizOcBK1A543qwcjJ/REG8A449miIMDio=", 709357581, 13175, 3, "AAAAAAAAAAAAE+LxcAx88O3ofi2qtCeQshzdqA0AAAA=", 2.3261311366047874e+21, 5982];
        top_header = ["header", 130700, "yClicPvrQ4Ul5sk4hbsrJ62drzli1tue/mf8TYW2dZU=", "Dq6o8Xg3qiUVzMpzXkKijFtlhFd66KQlw2qiN8x37KI=", "bZM+MzTkULo4gzZ8hBlZLqTfWDmvxCnSL684GZSFCn8=", 803559907, 13378, 3, "AAAAAAAAAAAAB4P1tQgLilI01L0VFKSUOcygSIIAAAA=", 2.3808044578490653e+21, 5982];

        //write_header(top_header, 656722944829204);
        //write_header(top_header, 670203372402906);
        write_header(top_header, 781489233254590);


//to find the ewah headers_object.read_ewah(hash(headers_object.serialize(headers_object.top())));
    }
    
    //var top_header = 0;//stores the valid header with the most accumulated work.
    //var top_hash = hash(serialize_header(top_header));
    //headers_db[top_hash] = top_header;
    
    var top_diff = 0;//accumulative difficulty of top
    function write_header(header, ewah) {
        var acc_difficulty = header[9];
        if ((acc_difficulty > top_diff) || ((mode == "test")&&((top_header == 0) || (header[1] > top_header[1])))) {
            top_diff = acc_difficulty;
            top_header = header;
        }
        h = hash(serialize_header(header));
        headers_db[h] = [header, ewah];
    }
    function read_ewah(hash) {
	if (headers_db[hash]) {
	    return headers_db[hash][1];
	} else { return  undefined; }
    }
    function read_header(hash) {
	if (headers_db[hash]) {
	    return headers_db[hash][0];
	} else { return  undefined; }
    }
    function list_to_uint8(l) {
        var array = new Uint8Array(l.length);
        for (var i=0; i<l.length; i++) {
            a[i] = l[i];
        }
        return array;
    }
    function pair2sci(x, b) {
        return (256 * x) + b;
    }
        //calculate X. ad 1 for every zero bit starting from the beginning of the h. Stop as soon as you reach a non-zero bit.
        // calculate B. take the next 8 bits from h after calculating x, and interpret it as an integer.
        //return pair2sci(X, B);
    function difficulty_should_be(NextHeader, hash) {
        var header = read_header(hash);//headers_db[hash];
        if ( header == undefined ) {
            //console.log(headers_db);
            //console.log(hash);
            //console.log(header);
            //console.log("received an orphan header");
            return "unknown parent";
        } else {
            var Diff = header[6];
            var RF = retarget_frequency; //constants:retarget_frequency();
            var height = header[1];
            //var x = height % RF;//fork
	    if (height > forks.four) {
		x = height % Math.floor(RF / 2);
	    } else {
		x = height % RF;
	    }
	    var PrevEWAH = read_ewah(hash);
	    var EWAH = calc_ewah(NextHeader, header, PrevEWAH);
	    if (height > forks.seven)  {
		return [new_target(header, EWAH), EWAH];
		//console.log("working here");
		//return 0;
	    } else if ( ( x == 0 ) && (! (height < 10) )) {
                return [difficulty_should_be2(header), EWAH];
            } else {
		return [Diff, EWAH]; }
        }
    }
    function new_target(header, EWAH0) {
	//console.log(EWAH0);
	var EWAH = bigInt.max(EWAH0, 1);
	var diff = header[6];
	var hashes = sci2int(diff);
	var estimate = bigInt.max(1, hashes.times(hashrate_converter()).divide(EWAH)).toJSNumber();
	//console.log("estimate is ");
	//console.log(estimate);//1670
	//console.log("EWAH is ");
	//console.log(EWAH);//1670
	//console.log("diff is ");
	//console.log(diff);//1670
	var P = header[10];
	var UL = Math.floor(P * 6 / 4);
	var LL = Math.floor(P * 3 / 4);
	var ND = diff;
	if (estimate > UL) {
	    ND = pow_recalculate(diff, UL, estimate);
	} else if (estimate < LL) {
	    ND = pow_recalculate(diff, LL, estimate);
	}
	//console.log(ND);//1
	return Math.max(ND, INITIAL_DIFFICULTY);
    }
    function retarget2(header, n, ts) {
	//console.log(JSON.stringify(header));
        var t = header[5];
        ts.push(t);
        //var height = header[1];
        //if ((height == 0) || (n == 0)) {
        if (n == 0) {
            return {"header":header, "times":ts};
        }
        else {
            var prev_hash = string_to_array(atob(header[2]));
            var prev_header = read_header(prev_hash);//headers_db[prev_hash];
            return retarget2(prev_header, n-1, ts);
        }
    }
    function median(l) {
        l.sort(function(a, b) {return a - b;});
        var half = Math.floor(l.length / 2);
        return l[half];
    }
    function difficulty_should_be2(header) {
        var period = header[10];
        var f = Math.floor(retarget_frequency / 2); //constants:retarget frequencey is 2000
        var a1 = retarget2(header, f - 1, []);
        var times1 = a1.times;
        var header2000 = a1.header;
        var a2 = retarget2(header2000, f - 1, []);
        var times2 = a2.times;
        var m1 = median((times1).reverse().slice(1));
        var m10 = median((times1).reverse().slice(0));
        var m2 = median((times2).reverse());//628500
        var tbig = m1 - m2;
        var t0 = Math.floor(tbig / f);//limit to 700 seconds
	var t = Math.min(t0, Math.floor(period * 7 / 6));//upper limit of 16.66% decrease in difficulty.
	var old_diff = header2000[6];
        var nt = pow_recalculate(
            old_diff,
            period,
            Math.max(1, t));//current estimated block time
        var done = Math.max(nt, INITIAL_DIFFICULTY);
        return done;//initial difficulty
    }
    function pow_recalculate(oldDiff, t, bottom) {
        var old = sci2int(oldDiff);
	var n = old.times(t).divide(bottom);
        //var n = Math.max(1, Math.floor(( old * t ) / bottom));
        //var n = Math.max(1, Math.floor(( old / bottom) * t));
	
        var d = int2sci(n);
        return Math.max(1, d);
    }
    function log2(x) {
	if (x.eq(0)) { return 1; }
	else if (x.eq(1)) { return 1; }
        //if (x == 1) { return 1; }
        else { return 1 + log2(x.divide(2))}
        //else { return 1 + log2(Math.floor(x / 2))}
    }
    function exponent(a, b) {//a is type bigint. b is an int.
        if (b == 0) { return bigInt(1); }
        else if (b == 1) { return a; }
        else if ((b % 2) == 0) {return exponent(a.times(a), Math.floor(b / 2)); }
        else {return a.times(exponent(a, b-1)); }
    }
    function sci2int(x) {
        function pair2int(l) {
            var b = l.pop();
            var a = l.pop();
            var c = exponent(bigInt(2), a);//c is a bigint
	    return c.times((256 + b)).divide(256);
            //return Math.floor((c * (256 + b)) / 256);
        }
        function sci2pair(i) {
            var a = Math.floor(i / 256);
            var b = i % 256;
            return [a, b];
        }
        return pair2int(sci2pair(x));
    }
    function int2sci(x) {
        function pair2sci(l) {
            var b = l.pop();
            var a = l.pop();
            return (256 * a) + b;
        }
        function int2pair(x) {
            var a = log2(x) - 1;
            var c = exponent(bigInt(2), a);
	    var b = x.times(256).divide(c).minus(256).toJSNumber();
            //var b = Math.floor((x * 256) / c) - 256;
            return [a, b];
        }
        return pair2sci(int2pair(x));
    }
    function check_pow(header) {
        //calculate Data, a serialized version of this header where the nonce is 0.
        var height = header[1];
        //if (height < 1) { return [true, 1000000]; }
        if (height < 1) { return [true, 1]; }
        else {
            var prev_hash = string_to_array(atob(header[2]));
            var diff0L = difficulty_should_be(header, prev_hash);
	    var diff0 = diff0L[0];
	    var EWAH = diff0L[1];
            var diff = header[6];
            if (diff == diff0) {
                var nonce = atob(header[8]);
                var data = JSON.parse(JSON.stringify(header));
                data[8] = btoa(array_to_string(integer_to_array(0, 32)));
                var s1 = serialize_header(data);
                var h1 = hash(hash(s1));
		var foo, h2, I;
		if (height > (forks.two - 1)) {
		    var nonce2 = nonce.slice(-23),
		    foo = h1.concat(string_to_array(nonce2));
		    //console.log(foo);
		    //console.log(nonce2);
                    h2 = hash(foo);
                    I = newhash2integer(h2);
		} else {
                    foo = h1.concat(
			integer_to_array(diff, 2)).concat(
                            string_to_array(nonce));
                    h2 = hash(foo);
                    I = hash2integer(h2);
		}
                return [I > diff, EWAH];
            } else {
                //console.log("bad diff");
                //console.log(diff);//from server
                //console.log(diff0);
                return [false, 0];
            }
        }
    }
    //function hashrate_converter() { return 1048576; }
    function hashrate_converter() { return 1024; }
    function calc_ewah(header, prev_header, prev_ewah0) {
	var prev_ewah = bigInt.max(1, prev_ewah0);
	//console.log("prev_ewah: ");
	//console.log((prev_ewah).toJSNumber());
	var DT = header[5] - prev_header[5];
	//maybe check that the header's time is in the past.
	var Hashrate0 = bigInt.max(bigInt(1),
				   bigInt(hashrate_converter()).times(sci2int(prev_header[6])).divide(DT));
	var N = 20;
	var Converter = prev_ewah.times(1024000);
	var EWAH2 = Converter.times((N - 1)).divide(prev_ewah);
	var EWAH0 = (Converter.divide(Hashrate0)).add(EWAH2);
	var ewah = Converter.times(N).divide(EWAH0).toJSNumber();
	/*
	console.log("header number");
	console.log(JSON.stringify(header[1]));
	console.log("prev_ewah: ");
	console.log(prev_ewah0);// should be 1, is 1000000
	console.log(prev_ewah.toJSNumber());// should be 1, is 1000000
	console.log("dt: ");
	console.log(DT);
	console.log("hashrate0: ");
	console.log(Hashrate0.toJSNumber());
	console.log("ewah0: ");
	console.log(EWAH0.toJSNumber());//should be 20480000, is 1024019456000
	console.log("ewah: ");
	console.log(ewah);//should be 1, is 19
	*/
	
	//var Hashrate0 = Math.floor(Math.max(1, hashrate_converter() * sci2int(prev_header[6]) / DT));
	//var Hashrate = Math.min(Hashrate0, prev_ewah * 4);
	//var N = 20;
	//var ewah = Math.floor((Hashrate + ((N - 1) * prev_ewah)) / N);
	return ewah;
    }
    function absorb_headers(h) {
	//console.log(JSON.stringify(h[1]));
        var get_more = false;
        for (var i = 1; i < h.length; i++ ) {
            var bl = check_pow(h[i]);
	    var b = bl[0];
	    var ewah = bl[1];
            if ( b ) {
                var header = h[i];
                var height = header[1];
                var header_hash = hash(serialize_header(header));
		//var ewah = 1000000;
                if ( height == 0 ) {
                    header[9] = 0;//accumulative difficulty
                } else {
                    var prev_hash = string_to_array(atob(header[2]));
                    var prev_header = read_header(prev_hash);//headers_db[prev_hash];
                    prev_ac = prev_header[9];
                    diff = header[6];
                    //var ac = sci2int(diff) / 10000000000;
                    var ac = sci2int(diff);
                    header[9] = prev_ac + ac - 1;
                }
                if (!(header_hash in headers_db)) {
                    get_more = true;
                }
                write_header(header, ewah);}
            else {
                //console.log("bad header");
                //console.log(JSON.stringify(h[i])); 
			}
        }
        if (get_more) { more_headers(); }
        else {
			console.log("Height: " + top_header[1]);
		}
		
    }
    function more_headers() {
        var n;
        if ( top_header == 0 ) {
            n = 0;
        } else {
            n = top_header[1];
        }
        rpc.post(["headers", headers_batch + 1, n], absorb_headers);
    }
    function serialize_header(x) {
        var height = x[1]; //4 bytes
        var prev_hash = atob(x[2]); //bin
        var trees_hash = atob(x[3]); //bin
        var txs_proof_hash = atob(x[4]); //bin
        var time = x[5]; //4 bytes
        var difficulty = x[6]; // 3 bytes
        var version = x[7]; // 2 bytes
        var nonce = atob(x[8]); // 32 bytes
        var period = x[10];
        var y = string_to_array(prev_hash);
        return y.concat(
            integer_to_array(height, 4)).concat(
                integer_to_array(time, 5)).concat(
                    integer_to_array(version, 2)).concat(
                        string_to_array(trees_hash)).concat(
                            string_to_array(txs_proof_hash)).concat(
                                integer_to_array(difficulty, 2)).concat(
                                    string_to_array(nonce)).concat(
                                        integer_to_array(period, 2));
    }
    function hash_test() {
        console.log(hash([1,4,6,1,2,3,4,4]));
        var z = integer_to_array(1000, 4);
        var s = array_to_string(z);
        var a = atob("AAAD6A==");
        var g = string_to_array(a);
        var f = string_to_array(s);
        console.log(JSON.stringify(a));
        console.log(JSON.stringify(s));
        console.log(JSON.stringify(g));
        console.log(JSON.stringify(f));
        console.log(JSON.stringify(hash(g)));
        console.log(JSON.stringify(hash(f)));
    }
    function header_test() {
        rpc.post(["headers", 10, 0], header_test2);
    }
    function header_test2(hl) {
        console.log(hl);
        absorb_headers(hl);
    }
    function on_height_change(callback) {
        var h = top_header[1];
        return on_height_change2(h, callback);
    }
    function on_height_change2(h, callback) {
        var h2 = top_header[1];
        if (h2 > h) {
            return callback();
        }
        return setTimeout(function() { return on_height_change2(h, callback), 1000});
    }
    //test();
    function test() {
        console.log(sci2int(2000));//should be 232
        console.log(int2sci(2000));//should be 2804
        console.log(sci2int(int2sci(2000)));// should be 2000
    }
        return {more_headers: more_headers,
                sci2int: sci2int,
                serialize: serialize_header,
                top: (function() { return top_header; }),
                db: headers_db,
                read_ewah: read_ewah,
                on_height_change: on_height_change,
                forks: forks};
}
var headers_object = headers_main();

function keys_function1() {
    var ec = new elliptic.ec('secp256k1');
    var keys_internal;

    function new_keys_watch(x) {
	return ec.keyFromPublic(x);
    }
    function new_keys_entropy(x) {
        return ec.genKeyPair({entropy: hash(serialize([x]))});
    }
    function new_keys() {
        return ec.genKeyPair();
    }
    function pubkey_64() {
        var pubPoint = keys_internal.getPublic("hex");
        return btoa(fromHex(pubPoint));
    }
	
	function brainWallet(x) {
		keys_internal = new_keys_entropy(x);
	}
    function powrem(x, e, p) {
        //if (e == 0n) {
        if (e == 0) {
            //return 1n;
            return 1;
        //} else if (e == 1n) {
        } else if (e == 1) {
            return x;
        //} else if ((e % 2n) == 0n) {
        } else if ((e % 2) == 0) {
            return powrem(((x * x) % p),
                          //(e / 2n),
                          (e / 2),
                          p);
        } else {
            //return (x * powrem(x, e - 1n, p)) % p;
            return (x * powrem(x, e - 1, p)) % p;
        }
    };
    function decompress_pub(pub) {
        //pub = "AhEuaxBNwXiTpEMTZI2gExMGpxCwAapTyFrgWMu5n4cI";
        //var p = 115792089237316195423570985008687907853269984665640564039457584007908834671663n;
        var p = 0;
        var b = atob(pub);
        var a = string_to_array(b);
        var s = BigInt(a[0] - 2);
        var x = big_array_to_int(a.slice(1, 33));
        //var y2 = (((((x * x) % p) * x) + 7n) % p);
        var y2 = (((((x * x) % p) * x) + 7) % p);
        //var y = powrem(y2, ((p+1n) / 4n), p);
        var y = powrem(y2, ((p+1) / 4), p);
        //if (!(s == (y % 2n))) {
        if (!(s == (y % 2))) {
            y = ((p - y) % p);
        }
        pub = [4].concat(big_integer_to_array(x, 32)).concat(big_integer_to_array(y, 32));
        return btoa(array_to_string(pub));
    }
    function compress_pub(p) {
        var b = atob(p);
        var a = string_to_array(b);
        var x = a.slice(1, 33);
        var s = a[64];
        var f;
        if ((s % 2) == 0) {
            f = 2;
        } else {
            f = 3;
        }
        return btoa(array_to_string([f].concat(x)))
    }
    function raw_sign(x) {
        var h = hash(x);
        var sig = keys_internal.sign(h);
        var sig2 = sig.toDER();
        return btoa(array_to_string(sig2));
    }
    function sign_tx(tx) {
        var sig;
        var stx;
	if (tx[0] == "signed") {
	    console.log(JSON.stringify(tx));
            //var sig = raw_sign(tx[1]);
	    sig = btoa(array_to_string(sign(tx[1], keys_internal)));
	    stx = tx;

	} else {
            sig = btoa(array_to_string(sign(tx, keys_internal)));
            stx = ["signed", tx, [-6], [-6]];
	}
	var pub = pubkey_64();
	if ((stx[1][0] == -7) || (pub == stx[1][1])) {
	    stx[2] = sig;
	} else if (pub == stx[1][2]) {
	    stx[3] = sig;
	} else {
	    console.log(JSON.stringify(tx));
	    throw("sign error");
	}
        return stx;
    }
    
    function check_balance(Callback) {
        var trie_key = pubkey_64();
        //var top_hash = hash(headers_object.serialize(headers_object.top()));
        merkle.request_proof("accounts", trie_key, function(x) {
	    Callback(x[1]);
        });
    }
   
    function encrypt(val, to) {
        return encryption_object.send(val, to, keys_internal);
    }
    function decrypt(val) {
	return encryption_object.get(val, keys_internal);
    }
    return {make: new_keys,
            pub: pubkey_64,
            raw_sign: raw_sign,
            sign: sign_tx,
            ec: (function() { return ec; }),
            encrypt: encrypt,
            decrypt: decrypt,
            check_balance: check_balance,
            keys_internal: (function() {return keys_internal;}),
            compress: compress_pub,
            decompress: decompress_pub,
			brainWallet: brainWallet};
}
var keys = keys_function1();

//https://github.com/indutny/elliptic/blob/master/test/ecdsa-test.js

//var key = ec.genKeyPair();
//var ec = new elliptic.ec('secp256k1');

//var msg = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ];
//var signature = key.sign(msg);


function serialize(data) {
    if (Number.isInteger(data)) {
        //console.log("serialize integer");
        //<<3:8, X:512>>;
        var x = integer_to_array(3, 1).concat(
            integer_to_array(data, 64));
        return x;
    } else if (Array.isArray(data)) {
        if (data[0] == -6) { //its a list.
            //console.log("serialize array");
            //<<1:8, S:32, A/binary>>;
            var d0 = data.slice(1);
            var rest = serialize_list(d0);
            return integer_to_array(1, 1).concat(
                integer_to_array(rest.length, 4)).concat(
                    rest);

        } else if (data[0] == -7) { //it is a tuple
            //console.log("serialize tuple 1");
            //<<2:8, S:32, A/binary>>;
            var d0 = data.slice(1);
            var rest = serialize_list(d0);
            return integer_to_array(2, 1).concat(
                integer_to_array(rest.length, 4)).concat(
                    rest);
        } else if (typeof(data[0]) == "string") { //assume it is a record. a tuple where the first element is an atom. This is the only place that atoms can occur.
            //console.log("serialize tuple 2");
            var h = data[0];
            var d0 = data.slice(1);
            //<<4:8, S:32, A/binary>>;
            var atom_size = h.length;
            var first = integer_to_array(4, 1).concat(
                integer_to_array(atom_size, 4)).concat(
                    string_to_array(h));
            //console.log(JSON.stringify(first));
            var rest = first.concat(serialize_list(d0));
            return integer_to_array(2, 1).concat(
                integer_to_array(rest.length, 4)).concat(
                    rest);
        }
    }
    //assume it is a binary
    //console.log("serialize binary");
    //<<0:8, S:32, X/binary>>;
    if (typeof(data) == "string") {
        var rest = string_to_array(atob(data));
        return integer_to_array(0, 1).concat(
            integer_to_array(rest.length, 4)).concat(
                rest);
    } else {
        return integer_to_array(0, 1).concat(
            integer_to_array(data.length, 4)).concat(
                data);
    }
    function serialize_list(l) {
        var m = [];
        for (var i = 0; i < l.length; i++) {
            m = m.concat(serialize(l[i]));
        }
        return m;
    }
}
function sign(data, key) {
    //ecdsa, sha356
    var d2 = serialize(data);
    var h = hash(d2);
    var sig = key.sign(h);
    return sig.toDER();
}
function verify(data, sig0, key) {
    var sig = bin2rs(atob(sig0));
    var d2 = serialize(data);
    var h = hash(d2);
    return key.verify(h, sig, "hex");
}
function verify1(tx) {
    var pub;
    if (tx[1][0] == -7) {
        pub = tx[1][2];
    } else {
        pub = tx[1][1];
    }
    return verify(tx[1], tx[2], keys.ec().keyFromPublic(toHex(atob(pub)), "hex"));
}
function verify2(tx) {
    return verify(tx[1], tx[3], keys.ec().keyFromPublic(toHex(atob(tx[1][2])), "hex"));
}
function verify_both(tx) {
    return (verify1(tx) && verify2(tx));
}
function bin2rs(x) {
    /*
      0x30 b1 0x02 b2 (vr) 0x02 b3 (vs)
      where:
      
      b1 is a single byte value, equal to the length, in bytes, of the remaining list of bytes (from the first 0x02 to the end of the encoding);
      b2 is a single byte value, equal to the length, in bytes, of (vr);
      b3 is a single byte value, equal to the length, in bytes, of (vs);
      (vr) is the signed big-endian encoding of the value "r", of minimal length;
      (vs) is the signed big-endian encoding of the value "s", of minimal length.
    */
    var h = toHex(x);
    var a2 = x.charCodeAt(3);
    var r = h.slice(8, 8+(a2*2));
    var s = h.slice(12+(a2*2));
    return {"r": r, "s": s};
}


//signing_test();
function signing_test() {

    //priv1 = atob("2kYbRu2TECMJzZy55fxdILBvM5wJM482lKLTRu2e42U=");
    //var key1 = keys.ec().genKeyPair({entropy: priv1});
    //var sig1 = sign([-6, 1], key1);
    //console.log(verify([-6, 1], sig1, key1));

    var stx = ["signed",["nc","BCjdlkTKyFh7BBx4grLUGFJCedmzo4e0XT1KJtbSwq5vCJHrPltHATB+maZ+Pncjnfvt9CsCcI9Rn1vO+fPLIV4=","BCPuHeZ7sRjKAlnJjEqz3JOgc+OX/M0hRhA6IcQp+/KYSHrbP6wT+ei5VPzPaabU6eS3AE+4DbcgQj/eMaGRglQ=",50050,2,29999,29998,100,1],"MEUCIHc0anEc4ujgGkN5h8dUgoyCPFZ7dW5kh2MjCFn2O6NeAiEAtIg83JJLtk13i3jqgPdio8EE1lcQPBhy/9HWNKy3x7w=","MEQCIAXKdfeRxhtUHTx602gEqFA7xic+48La3Ju1pR43ZxWXAiAiaLPpTK5JoJ6sj3BltNm4pofrWN3r2XOGksA17XVKyg=="];
    //var stx = ["signed",["create_acc_tx","BHuqX6EKohvveqkcbyGgE247jQ5O0i2YKO27Yx50cXd+8J/dCVTnMz8QWUUS9L5oGWUx5CPtseeHddZcygmGVaM=",1,20,"BJh+CRhyKiDRSJfjUFMwUVdC/3+Ahj644HWxbLzlddhggWg+2c+h1/i9u8ono9v3l7Vb4E5WSEZouDUUH2XDI58=",150000000000],"TUVVQ0lRRDRVUjVwV1M4bWM2U1dvK2EzWDY3WlBrRnk4Mlg3cW9qNkxXTTFaUzJ1MGdJZ2JGTmlkWFdYNDJ0V2dEcUZ5aUo4NnhqWnVTMlZKNGwxTGJvcjdWeFVXckU9",[-6]];

    var data0 = stx[1];
    var sig0 = stx[2];
    var key0 = keys.ec().keyFromPublic(toHex(atob(stx[1][1])), "hex");

    var foo = verify(data0, sig0, key0);
    console.log(foo);
    console.log(verify1(stx));
}

//setTimeout(signing_test2(), 1000);
//signing_test2();
function signing_test2() {
    //var d = ["record", [-6, 4], [-7, 8000], -50];
    var d = ["record", "BAr8BCYGo1WwDoB1KXU7xvdqRetLJbyEyRgT7NyBggkYUVW5oalfek1imezEb00Ww+61aiXNrkkBC8EEKsGjumw=", [-6, ["a", -2000]]];
    console.log("signing test");
    console.log(JSON.stringify(serialize(d)));
    var stx = keys.sign(d);
    var key0 = keys.ec().keyFromPublic(toHex(atob(keys.pub())), "hex");
    var b = verify(stx[1], stx[2], key0);
    console.log(b);
}
//signing_test3();
function signing_test3() {
    //ingredients
    var k = keys.make();
    var data = [];
    //signing 
    var d = hash(serialize(data));
    var sig2 = btoa(array_to_string(k.sign(d).toDER()));
    //verifying
    var sig3 = bin2rs(atob(sig2));
    var b = k.verify(d, sig3, "hex");
    console.log(b);
}
//signing_test4();
function signing_test4() {
    var k = keys.make();
    var data = [];
    var sig = btoa(array_to_string(sign(data, k)));
    console.log(verify(data, sig, k));
}

//api

var veo = {};
var FEE = 152050;
veo.server = function(ip,port) {
	SERVER_IP = ip;
	SERVER_PORT = port;
}

veo.sync = function() {
	console.log("Syncing...")
	headers_object.more_headers();
}

veo.top = function () {
	return headers_object.top();
}

veo.key = function (passphrase) {
	keys.brainWallet(passphrase);
}

veo.pub = function() {
	return keys.pub();
}

veo.account = function(callback) {
	if (!callback) callback = console.log;
	merkle.request_proof("accounts", keys.pub(), callback)
}

veo.unconfirmed =  function(callback) { 
	if (!callback) callback = console.log;
	rpc.post(["account", keys.pub()], callback);
}

veo.send = function(amount, to, callback) { 
	if (!callback) callback = console.log;
	rpc.post(["account", keys.pub()], function(ma) {
		var nonce = ma[2] + 1;
		to = parse_address(to);
		rpc.post(["account", to], function(them) {
			var tx;
            if(them == "empty"){
				tx = ["create_acc_tx", keys.pub(), nonce, FEE, to, amount];
            } 
			else {
		        tx = ["spend", keys.pub(), nonce, FEE, to, amount, 0];
            }
			var stx = keys.sign(tx);
			post_txs([stx], callback);
		});
	});		
}

veo.sweep = function(to,callback) {
	veo.unconfirmed(function(acc) {
		veo.send(acc[1]-FEE, to, callback)
	});
}

return veo;

}

var veo = Veo();
