package com.omgithub.fracturedskies

import kotlin.math.floor
import kotlin.math.sqrt

class Rng(seed: Long) {
    private var state = if (seed == 0L) 0x9E3779B97F4A7C15uL.toLong() else seed

    fun nextLong(): Long {
        state += -0x61c8864680b583ebL
        var z = state
        z = (z xor (z ushr 30)) * -0x40a7b892e31b1a47L
        z = (z xor (z ushr 27)) * -0x6b2fb644ecceee15L
        return z xor (z ushr 31)
    }

    fun nextInt(bound: Int): Int {
        if (bound <= 0) return 0
        return ((nextLong() ushr 1) % bound).toInt()
    }

    fun range(min: Float, max: Float): Float = min + nextFloat() * (max - min)
    fun nextFloat(): Float = ((nextLong() ushr 40) and 0xFFFFFF).toFloat() / 0xFFFFFF.toFloat()
    fun chance(p: Float): Boolean = nextFloat() < p
    fun <T> pick(values: List<T>): T = values[nextInt(values.size)]
}

object Noise {
    fun hash(x: Int, z: Int, seed: Int): Float {
        var h = x * 374761393 + z * 668265263 + seed * 1442695041
        h = (h xor (h ushr 13)) * 1274126177
        h = h xor (h ushr 16)
        return (h and 0x7FFFFFFF).toFloat() / 0x7FFFFFFF.toFloat()
    }

    private fun smooth(t: Float): Float = t * t * (3f - 2f * t)

    fun value(x: Float, z: Float, seed: Int): Float {
        val xi = floor(x).toInt()
        val zi = floor(z).toInt()
        val xf = x - xi
        val zf = z - zi
        val u = smooth(xf)
        val v = smooth(zf)
        val a = hash(xi, zi, seed)
        val b = hash(xi + 1, zi, seed)
        val c = hash(xi, zi + 1, seed)
        val d = hash(xi + 1, zi + 1, seed)
        val top = a + (b - a) * u
        val bottom = c + (d - c) * u
        return top + (bottom - top) * v
    }

    fun fbm(x: Float, z: Float, seed: Int, octaves: Int = 4): Float {
        var amp = 0.5f
        var freq = 1f
        var sum = 0f
        var norm = 0f
        repeat(octaves) {
            sum += value(x * freq, z * freq, seed + it * 1013) * amp
            norm += amp
            amp *= 0.5f
            freq *= 2.03f
        }
        return sum / norm
    }

    fun ridged(x: Float, z: Float, seed: Int, octaves: Int = 4): Float {
        var amp = 0.5f
        var freq = 1f
        var sum = 0f
        var norm = 0f
        repeat(octaves) {
            val n = 1f - kotlin.math.abs(value(x * freq, z * freq, seed + it * 617) * 2f - 1f)
            sum += n * n * amp
            norm += amp
            amp *= 0.5f
            freq *= 2.11f
        }
        return sum / norm
    }

    fun distance(ax: Float, az: Float, bx: Float, bz: Float): Float {
        val dx = ax - bx
        val dz = az - bz
        return sqrt(dx * dx + dz * dz)
    }
}
