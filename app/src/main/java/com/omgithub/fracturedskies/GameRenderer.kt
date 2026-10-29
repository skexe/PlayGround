package com.omgithub.fracturedskies

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

class GameRenderer(private val g: Game) {
    private val kit = DrawKit(g)
    private val cyan = 0xFF37F2D4.toInt()
    private val cyanDim = 0xFF1C8E83.toInt()
    private val orange = 0xFFFF7B4D.toInt()
    private val cream = 0xFFF5E9C8.toInt()
    private val white = 0xFFF2F6F3.toInt()
    private val muted = 0xFF83969D.toInt()
    private val danger = 0xFFFF5E5E.toInt()
    private val yellow = 0xFFFFD85E.toInt()
    private val dark = 0xFF05070D.toInt()
    private val panelDark = 0xD4070F18.toInt()
    private var scanlineShader: BitmapShader? = null

    private var camX = 0f
    private var camY = 0f
    private var camZ = 0f
    private var camYaw = 0f
    private var camPitch = 0f
    private var focal = 1f
    private var horizonY = 0f

    private data class CamPoint(val x: Float, val y: Float, val z: Float)
    private data class Projected(val x: Float, val y: Float, val depth: Float, val scale: Float)
    private data class QuadDraw(val path: Path, val color: Int, val depth: Float, val edge: Int, val strokeWidth: Float)
    private data class PropDraw(val depth: Float, val draw: (Canvas) -> Unit)

    init {
        val bmp = Bitmap.createBitmap(2, 4, Bitmap.Config.ARGB_8888)
        bmp.eraseColor(Color.TRANSPARENT)
        bmp.setPixel(0, 0, 0x14000000)
        bmp.setPixel(1, 0, 0x00000000)
        bmp.setPixel(0, 2, 0x08000000)
        bmp.setPixel(1, 2, 0x00000000)
        scanlineShader = BitmapShader(bmp, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
    }

    fun draw(canvas: Canvas) {
        kit.begin(canvas)
        when (g.screen) {
            Screen.TITLE -> drawTitle(canvas)
            Screen.SURFACE -> drawSurface(canvas)
            Screen.SPACE -> drawSpace(canvas)
            Screen.GALAXY -> {
                drawSpace(canvas, controls = false)
                drawGalaxy(canvas)
            }
            Screen.STATION -> {
                drawSpace(canvas, controls = false)
                drawStation(canvas)
            }
            Screen.INVENTORY -> {
                if (g.previousScreen == Screen.SPACE) drawSpace(canvas, controls = false)
                else drawSurface(canvas, hud = false)
                drawInventory(canvas)
            }
            Screen.CRAFT -> {
                if (g.previousScreen == Screen.SPACE) drawSpace(canvas, controls = false)
                else drawSurface(canvas, hud = false)
                drawCraft(canvas)
            }
            Screen.CODEX -> {
                drawCodexBackdrop(canvas)
                drawCodex(canvas)
            }
            Screen.PAUSE -> {
                if (g.previousScreen == Screen.SPACE) drawSpace(canvas, controls = false)
                else drawSurface(canvas, hud = false)
                drawPause(canvas)
            }
            Screen.WARP -> drawWarp(canvas)
        }
        if (g.toastTime > 0f && g.screen != Screen.WARP) drawToast(canvas)
        drawGlobalChrome(canvas)
        kit.finish()
    }

    private fun drawGlobalChrome(canvas: Canvas) {
        kit.fill.shader = scanlineShader
        kit.fill.alpha = 18
        canvas.drawRect(0f, 0f, kit.w, kit.h, kit.fill)
        kit.fill.shader = null
        kit.fill.alpha = 255
    }

    private fun drawTitle(canvas: Canvas) {
        drawNebulaBackground(canvas, animated = true)
        val w = kit.w
        val h = kit.h
        val s = kit.scale

        val cx = w * 0.76f
        val cy = h * 0.55f
        val radius = h * 0.66f
        kit.radial(cx, cy, radius * 1.18f, kit.alpha(orange, 55), kit.alpha(orange, 0))
        val planetRect = RectF(cx - radius * 0.78f, cy - radius * 0.56f, cx + radius * 0.78f, cy + radius * 0.84f)
        kit.fill.style = Paint.Style.FILL
        kit.fill.shader = LinearGradient(
            planetRect.left, planetRect.top, planetRect.right, planetRect.bottom,
            intArrayOf(0xFFF0A06A.toInt(), 0xFF9C4B3A.toInt(), 0xFF2B1D2B.toInt(), 0xFF070B13.toInt()),
            floatArrayOf(0f, 0.35f, 0.72f, 1f),
            Shader.TileMode.CLAMP
        )
        canvas.drawOval(planetRect, kit.fill)
        kit.fill.shader = null
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = 2.5f * s
        kit.stroke.color = kit.alpha(0xFFFFC28A.toInt(), 140)
        canvas.drawOval(planetRect, kit.stroke)
        kit.stroke.strokeWidth = 1.1f * s
        kit.stroke.color = kit.alpha(cyan, 70)
        canvas.drawArc(
            RectF(planetRect.left - 25f * s, planetRect.top - 8f * s, planetRect.right + 25f * s, planetRect.bottom + 8f * s),
            -15f, 195f, false, kit.stroke
        )
        for (i in 0 until 10) {
            val yy = planetRect.top + planetRect.height() * (0.18f + i * 0.06f)
            val alpha = (22 - i * 2).coerceAtLeast(4)
            kit.line(planetRect.left + 12f * s, yy, planetRect.right - 10f * s, yy + (i % 2 - 0.5f) * 8f * s, kit.alpha(cream, alpha), 0.7f)
        }

        kit.text("PROTOCOLO DE EXPLORACIÓN // ANDROID KOTLIN", w * 0.065f, h * 0.105f, 11f * s, kit.alpha(cyan, 210), kit.mono, Paint.Align.LEFT, 2.2f * s)
        kit.text("EXPEDICIÓN 01 · GALAXIA EUCLID", w * 0.065f, h * 0.135f, 10f * s, kit.alpha(muted, 220), kit.mono, Paint.Align.LEFT, 1.1f * s)

        kit.textGlow("NO MAN'S", w * 0.062f, h * 0.34f, 88f * s, cream, kit.sansBlack, Paint.Align.LEFT, 0xFFFFC79A.toInt())
        kit.textGlow("SKY", w * 0.062f, h * 0.47f, 112f * s, cream, kit.sansBlack, Paint.Align.LEFT, 0xFFFFC79A.toInt())
        kit.text("FRACTURED SKIES", w * 0.07f, h * 0.53f, 21f * s, cyan, kit.monoBold, Paint.Align.LEFT, 5.5f * s)
        kit.line(w * 0.068f, h * 0.565f, w * 0.36f, h * 0.565f, kit.alpha(orange, 190), 2f)

        kit.text(
            "Un universo procedural de 18.4 trillones de planetas.\nCada estrella, criatura y ruina existe gracias a una semilla.",
            w * 0.068f, h * 0.62f, 14.5f * s, 0xFFC4D0D1.toInt(), kit.sans, Paint.Align.LEFT
        )
        kit.text("SUPERVIVENCIA · EXPLORACIÓN · COMERCIO · NEXO", w * 0.068f, h * 0.695f, 10.5f * s, kit.alpha(muted, 230), kit.mono, Paint.Align.LEFT, 1.7f * s)

        val bx = w * 0.066f
        val by = h * 0.755f
        val bw = min(w * 0.245f, 360f * s)
        val bh = 55f * s
        kit.button("start", bx, by, bw, bh, "INICIAR EXPEDICIÓN", ButtonStyle.PRIMARY, "NUEVO UNIVERSO PROCEDURAL", "▶", orange)
        if (g.hasSave) {
            kit.button("continue", bx, by + bh + 14f * s, bw, bh, "CONTINUAR", ButtonStyle.ACTION, "SEÑAL GUARDADA", "◈", cyan)
        }
        kit.button("codex", bx + bw + 14f * s, by + bh + 14f * s, 142f * s, bh, "CÓDICE", ButtonStyle.GHOST, null, "⌬", cream)

        kit.panel(w - 295f * s, h - 126f * s, 255f * s, 76f * s, kit.alpha(cyan, 90), 0xB3070D14.toInt(), 12f * s)
        kit.text("UNIVERSO SEMBRADO", w - 275f * s, h - 97f * s, 9f * s, muted, kit.mono, Paint.Align.LEFT, 1.5f * s)
        kit.text("18 446 744 073 709 551 616", w - 275f * s, h - 72f * s, 12.5f * s, cream, kit.monoBold, Paint.Align.LEFT)
        kit.text("PLANETAS POSIBLES", w - 275f * s, h - 55f * s, 8.5f * s, kit.alpha(cyan, 200), kit.mono, Paint.Align.LEFT, 1.3f * s)

        drawHelmetCorners(canvas, 1f)
    }

    private fun drawNebulaBackground(canvas: Canvas, animated: Boolean) {
        val w = kit.w
        val h = kit.h
        kit.fill.shader = LinearGradient(
            0f, 0f, 0f, h,
            intArrayOf(0xFF02040A.toInt(), 0xFF07101C.toInt(), 0xFF0B1522.toInt(), 0xFF03060C.toInt()),
            null, Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, w, h, kit.fill)
        kit.fill.shader = null
        kit.radial(w * 0.18f, h * 0.18f, h * 0.55f, kit.alpha(0xFF213A8A.toInt(), 55), kit.alpha(0xFF213A8A.toInt(), 0))
        kit.radial(w * 0.82f, h * 0.18f, h * 0.45f, kit.alpha(0xFF7D2A5C.toInt(), 48), kit.alpha(0xFF7D2A5C.toInt(), 0))
        kit.radial(w * 0.52f, h * 0.92f, h * 0.5f, kit.alpha(0xFF0E5C61.toInt(), 35), kit.alpha(0xFF0E5C61.toInt(), 0))
        val t = if (animated) kit.time else 0f
        for (i in 0 until 170) {
            val seed = i * 7919
            val x = ((seed * 1103515245 + 12345) and 0x7FFFFFFF) % 10000 / 10000f * w
            val y = ((seed * 214013 + 2531011) and 0x7FFFFFFF) % 10000 / 10000f * h * 0.92f
            val tw = 0.35f + 0.65f * (0.5f + 0.5f * sin(t * (0.4f + (i % 7) * 0.12f) + i))
            val radius = (0.5f + (i % 5) * 0.32f) * kit.scale
            val col = if (i % 13 == 0) kit.alpha(cyan, (180 * tw).toInt()) else kit.alpha(cream, (150 * tw).toInt())
            kit.circle(x, y, radius, col)
        }
        val drift = sin(t * 0.07f) * 30f * kit.scale
        kit.radial(w * 0.58f + drift, h * 0.43f, h * 0.08f, kit.alpha(0xFFFFB86A.toInt(), 35), kit.alpha(0xFFFFB86A.toInt(), 0))
    }

    private fun drawHelmetCorners(canvas: Canvas, intensity: Float = 1f) {
        val w = kit.w
        val h = kit.h
        val m = 22f * kit.scale
        val len = 42f * kit.scale
        val c = kit.alpha(cyan, (120 * intensity).toInt())
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = 1.3f * kit.scale
        kit.stroke.color = c
        canvas.drawLine(m, m, m + len, m, kit.stroke)
        canvas.drawLine(m, m, m, m + len, kit.stroke)
        canvas.drawLine(w - m, m, w - m - len, m, kit.stroke)
        canvas.drawLine(w - m, m, w - m, m + len, kit.stroke)
        canvas.drawLine(m, h - m, m + len, h - m, kit.stroke)
        canvas.drawLine(m, h - m, m, h - m - len, kit.stroke)
        canvas.drawLine(w - m, h - m, w - m - len, h - m, kit.stroke)
        canvas.drawLine(w - m, h - m, w - m, h - m - len, kit.stroke)
        kit.text("EXO // HUD 4.2", m + 4f * kit.scale, h - m - 10f * kit.scale, 8.5f * kit.scale, kit.alpha(cyan, 120), kit.mono, Paint.Align.LEFT, 1.2f * kit.scale)
        kit.text("SEED ${java.lang.Long.toHexString(g.universe.currentSystem().seed).uppercase()}", w - m - 4f * kit.scale, h - m - 10f * kit.scale, 8.5f * kit.scale, kit.alpha(cyan, 120), kit.mono, Paint.Align.RIGHT, 1.2f * kit.scale)
    }

    private fun setupCamera() {
        camX = g.player.x
        camY = g.cameraHeight
        camZ = g.player.z
        camYaw = g.player.yaw
        camPitch = g.player.pitch
        focal = kit.h * 0.78f
        horizonY = kit.h * 0.5f + tan(camPitch) * focal
    }

    private fun transform(wx: Float, wy: Float, wz: Float): CamPoint {
        val dx = wx - camX
        val dy = wy - camY
        val dz = wz - camZ
        val cy = cos(camYaw)
        val sy = sin(camYaw)
        val cp = cos(camPitch)
        val sp = sin(camPitch)
        val rx = dx * cy - dz * sy
        val ry = dx * (-sy * sp) + dy * cp + dz * (-cy * sp)
        val rz = dx * (sy * cp) + dy * sp + dz * (cy * cp)
        return CamPoint(rx, ry, rz)
    }

    private fun projectCam(p: CamPoint): Projected? {
        if (p.z <= 0.18f) return null
        val s = focal / p.z
        return Projected(kit.w * 0.5f + p.x * s, kit.h * 0.5f - p.y * s, p.z, s)
    }

    private fun project(wx: Float, wy: Float, wz: Float): Projected? = projectCam(transform(wx, wy, wz))

    private fun clipNear(points: List<CamPoint>, near: Float = 0.18f): List<CamPoint> {
        if (points.isEmpty()) return emptyList()
        val out = ArrayList<CamPoint>(8)
        for (i in points.indices) {
            val a = points[i]
            val b = points[(i + 1) % points.size]
            val ain = a.z >= near
            val bin = b.z >= near
            if (ain) out.add(a)
            if (ain != bin) {
                val t = (near - a.z) / (b.z - a.z)
                out.add(CamPoint(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, near))
            }
        }
        return out
    }

    private fun drawSurface(canvas: Canvas, hud: Boolean = true) {
        setupCamera()
        drawPlanetSky(canvas)
        drawTerrain(canvas)
        drawSurfaceProps(canvas)
        drawAtmosphere(canvas)
        if (hud) drawSurfaceHud(canvas)
        drawHelmetCorners(canvas, if (hud) 0.9f else 0.25f)
        if (g.landingFlash > 0f) {
            kit.fill.shader = RadialGradient(
                kit.w / 2f, kit.h / 2f, kit.h * 0.8f,
                kit.alpha(cream, (g.landingFlash * 235).toInt()), kit.alpha(dark, 0),
                Shader.TileMode.CLAMP
            )
            canvas.drawRect(0f, 0f, kit.w, kit.h, kit.fill)
            kit.fill.shader = null
        }
    }

    private fun drawPlanetSky(canvas: Canvas) {
        val w = kit.w
        val h = kit.h
        val biome = g.world.planet.biome
        kit.fill.shader = LinearGradient(
            0f, 0f, 0f, max(horizonY, h * 0.2f),
            intArrayOf(biome.skyTop, biome.skyMid, biome.skyHorizon),
            floatArrayOf(0f, 0.58f, 1f), Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, w, max(horizonY + 2f, h), kit.fill)
        kit.fill.shader = null

        val seed = g.world.planet.seed
        for (i in 0 until 55) {
            val sx = ((i * 1543 + (seed and 0xFFF)) % 10000) / 10000f
            val sy = ((i * 7919 + ((seed ushr 8) and 0xFFF)) % 10000) / 10000f
            val x = ((sx - camYaw * 0.025f) % 1f + 1f) % 1f * w
            val y = sy * max(horizonY, h * 0.25f) * 0.82f
            val tw = 0.45f + 0.55f * (0.5f + 0.5f * sin(kit.time * 0.7f + i))
            kit.circle(x, y, (0.6f + (i % 3) * 0.35f) * kit.scale, kit.alpha(cream, (70 * tw).toInt()))
        }

        val sunAngle = 0.8f + ((seed % 360).toFloat() / 360f) * (PI.toFloat() * 2f)
        val sunDir = floatArrayOf(sin(sunAngle) * 0.8f, 0.55f, cos(sunAngle) * 0.8f)
        val sun = project(camX + sunDir[0] * 700f, camY + sunDir[1] * 700f, camZ + sunDir[2] * 700f)
        if (sun != null && sun.x > -w * 0.2f && sun.x < w * 1.2f && sun.y > -h * 0.2f && sun.y < h * 1.1f) {
            kit.radial(sun.x, sun.y, h * 0.29f, kit.alpha(0xFFFFD7A1.toInt(), 145), kit.alpha(0xFFFFD7A1.toInt(), 0))
            kit.radial(sun.x, sun.y, h * 0.065f, kit.alpha(0xFFFFFFFF.toInt(), 235), kit.alpha(0xFFFFD7A1.toInt(), 40))
        }

        val moonAngle = sunAngle + 2.25f
        val moon = project(
            camX + sin(moonAngle) * 740f,
            camY + 0.33f * 740f,
            camZ + cos(moonAngle) * 740f
        )
        if (moon != null && moon.x > -w * 0.3f && moon.x < w * 1.3f && moon.y > -h * 0.4f && moon.y < h * 1.2f) {
            val r = h * 0.17f
            kit.radial(moon.x, moon.y, r * 1.35f, kit.alpha(biome.high, 65), kit.alpha(biome.high, 0))
            kit.fill.style = Paint.Style.FILL
            kit.fill.shader = RadialGradient(
                moon.x - r * 0.3f, moon.y - r * 0.35f, r * 1.2f,
                intArrayOf(kit.mix(biome.high, cream, 0.25f), kit.dim(biome.mid, 0.72f), kit.dim(biome.low, 0.5f)),
                floatArrayOf(0f, 0.62f, 1f), Shader.TileMode.CLAMP
            )
            canvas.drawCircle(moon.x, moon.y, r, kit.fill)
            kit.fill.shader = null
            kit.stroke.style = Paint.Style.STROKE
            kit.stroke.strokeWidth = 1.2f * kit.scale
            kit.stroke.color = kit.alpha(cream, 85)
            canvas.drawCircle(moon.x, moon.y, r, kit.stroke)
            kit.stroke.color = kit.alpha(cyan, 60)
            canvas.drawCircle(moon.x, moon.y, r * 1.06f, kit.stroke)
        }

        val horizon = horizonY
        val mist = kit.alpha(biome.fog, 110)
        kit.fill.shader = LinearGradient(
            0f, horizon - h * 0.18f, 0f, horizon + h * 0.08f,
            intArrayOf(kit.alpha(biome.fog, 0), mist, kit.alpha(biome.fog, 20)),
            null, Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, horizon - h * 0.18f, w, horizon + h * 0.09f, kit.fill)
        kit.fill.shader = null

        drawMountainLayer(canvas, horizon, 0.0f, kit.alpha(biome.fog, 125), 0.55f, 0.019f)
        drawMountainLayer(canvas, horizon + h * 0.012f, 1.3f, kit.alpha(biome.fog, 205), 0.35f, 0.035f)

        for (i in 0 until 4) {
            val y = horizon - h * (0.08f + i * 0.055f) + sin(kit.time * 0.05f + i) * 5f * kit.scale
            val x = ((i * 0.31f - camYaw * 0.08f) % 1.5f + 1.5f) % 1.5f - 0.2f
            kit.fill.shader = LinearGradient(
                x * w, y, (x + 0.42f) * w, y,
                intArrayOf(kit.alpha(biome.fog, 0), kit.alpha(biome.fog, 35), kit.alpha(biome.fog, 0)),
                null, Shader.TileMode.CLAMP
            )
            canvas.drawOval(RectF(x * w, y, (x + 0.42f) * w, y + h * 0.025f), kit.fill)
            kit.fill.shader = null
        }
    }

    private fun drawMountainLayer(canvas: Canvas, baseY: Float, offset: Float, color: Int, amp: Float, freq: Float) {
        val w = kit.w
        val h = kit.h
        val path = Path()
        path.moveTo(0f, h)
        path.lineTo(0f, baseY)
        var x = 0f
        val step = max(3f, 14f * kit.scale)
        while (x <= w + step) {
            val n = Noise.fbm(
                (x / w) * 9f * freq * 55f + offset + camYaw * 5.2f,
                offset * 2.7f,
                (g.world.planet.seed xor 0x71A3).toInt(),
                4
            )
            val ridge = Noise.ridged((x / w) * 13f + camYaw * 7.3f + offset, offset, (g.world.planet.seed xor 0x9E37).toInt(), 3)
            val y = baseY - (n * 0.65f + ridge * 0.35f) * h * amp
            path.lineTo(x, y)
            x += step
        }
        path.lineTo(w, h)
        path.close()
        kit.fill.style = Paint.Style.FILL
        kit.fill.shader = null
        kit.fill.color = color
        canvas.drawPath(path, kit.fill)
    }

    private fun drawTerrain(canvas: Canvas) {
        val cell = 2.35f
        val radius = 23
        val baseX = floor(camX / cell) * cell
        val baseZ = floor(camZ / cell) * cell
        val draws = ArrayList<QuadDraw>(radius * radius * 2)
        val water = g.world.waterLevel()
        val seed = (g.world.planet.seed xor (g.world.planet.seed ushr 32)).toInt()
        val sun = normalize3(-0.42f, 0.77f, 0.48f)

        for (ix in -radius until radius) {
            for (iz in -radius until radius) {
                val x0 = baseX + ix * cell
                val z0 = baseZ + iz * cell
                val x1 = x0 + cell
                val z1 = z0 + cell
                val cx = (x0 + x1) * 0.5f
                val cz = (z0 + z1) * 0.5f
                val dist = Noise.distance(cx, cz, camX, camZ)
                if (dist > 94f) continue
                val h00 = g.world.terrain(x0, z0)
                val h10 = g.world.terrain(x1, z0)
                val h01 = g.world.terrain(x0, z1)
                val h11 = g.world.terrain(x1, z1)
                val avg = (h00 + h10 + h01 + h11) * 0.25f
                val isWater = water != null && avg < water
                val c0 = transform(x0, h00, z0)
                val c1 = transform(x1, h10, z0)
                val c2 = transform(x1, h11, z1)
                val c3 = transform(x0, h01, z1)
                if (c0.z < 0.18f && c1.z < 0.18f && c2.z < 0.18f && c3.z < 0.18f) continue
                val clipped = clipNear(listOf(c0, c1, c2, c3))
                if (clipped.size < 3) continue
                val projected = ArrayList<Projected>(clipped.size)
                var minX = Float.MAX_VALUE
                var maxX = -Float.MAX_VALUE
                var minY = Float.MAX_VALUE
                var maxY = -Float.MAX_VALUE
                var depth = 0f
                for (p in clipped) {
                    val pp = projectCam(p) ?: continue
                    projected.add(pp)
                    minX = min(minX, pp.x)
                    maxX = max(maxX, pp.x)
                    minY = min(minY, pp.y)
                    maxY = max(maxY, pp.y)
                    depth += pp.depth
                }
                if (projected.size < 3) continue
                depth /= projected.size
                if (maxX < -kit.w * 0.2f || minX > kit.w * 1.2f || maxY < -kit.h * 0.3f || minY > kit.h * 1.25f) continue

                val nx = (h00 + h01 - h10 - h11) / (2f * cell)
                val nz = (h00 + h10 - h01 - h11) / (2f * cell)
                val normal = normalize3(-nx, 1f, -nz)
                val lightDot = max(0f, normal[0] * sun[0] + normal[1] * sun[1] + normal[2] * sun[2])
                val light = 0.35f + lightDot * 0.75f
                var color = terrainColor(avg, cx, cz, seed, water, isWater)
                if (!isWater) color = kit.mix(kit.dim(color, 0.24f), color, light)
                val fogT = (1f - exp(-(dist / 58f) * (dist / 58f) * 1.7f)).coerceIn(0f, 1f)
                color = kit.mix(color, g.world.planet.biome.fog, fogT * 0.86f)

                val path = Path()
                path.moveTo(projected[0].x, projected[0].y)
                for (k in 1 until projected.size) path.lineTo(projected[k].x, projected[k].y)
                path.close()
                val edge = if (depth < 42f && !isWater) kit.alpha(kit.dim(color, 0.55f), (32 * (1f - fogT)).toInt()) else 0
                draws.add(QuadDraw(path, color, depth, edge, (0.55f + (1f - fogT) * 0.4f) * kit.scale))
            }
        }
        draws.sortByDescending { it.depth }
        for (q in draws) {
            kit.fill.style = Paint.Style.FILL
            kit.fill.shader = null
            kit.fill.color = q.color
            canvas.drawPath(q.path, kit.fill)
            if (q.edge != 0) {
                kit.stroke.style = Paint.Style.STROKE
                kit.stroke.strokeWidth = q.strokeWidth
                kit.stroke.color = q.edge
                canvas.drawPath(q.path, kit.stroke)
            }
        }
    }

    private fun terrainColor(height: Float, x: Float, z: Float, seed: Int, water: Float?, isWater: Boolean): Int {
        val biome = g.world.planet.biome
        if (isWater && water != null) {
            val depth = ((water - height) / 4f).coerceIn(0f, 1f)
            val shallow = kit.mix(biome.accent, 0xFF2A7FA8.toInt(), 0.55f)
            val deep = kit.mix(0xFF0A3550.toInt(), biome.low, 0.25f)
            return kit.mix(shallow, deep, depth)
        }
        val rel = ((height - g.world.spawnHeight + 11f) / 30f).coerceIn(0f, 1f)
        val base = if (rel < 0.4f) kit.mix(biome.low, biome.mid, rel / 0.4f)
        else kit.mix(biome.mid, biome.high, ((rel - 0.4f) / 0.6f).coerceIn(0f, 1f))
        val variation = Noise.value(x * 0.12f, z * 0.12f, seed + 53)
        val accentMix = ((variation - 0.5f) * 0.22f + 0.09f).coerceIn(0f, 0.2f)
        return kit.mix(base, biome.accent, accentMix)
    }


    private fun drawSurfaceProps(canvas: Canvas) {
        val draws = ArrayList<PropDraw>(260)
        val biome = g.world.planet.biome
        val seed = (g.world.planet.seed ushr 3).toInt()

        for (r in g.world.rocks) {
            val h = g.world.terrain(r.x, r.z)
            val p = project(r.x, h + r.size * 0.15f, r.z) ?: continue
            if (p.depth > 115f || p.x < -120f || p.x > kit.w + 120f || p.y < -100f || p.y > kit.h + 140f) continue
            draws.add(PropDraw(p.depth) { drawRock(canvas, r, p, seed) })
        }
        for (f in g.world.flora) {
            val h = g.world.terrain(f.x, f.z)
            val base = project(f.x, h, f.z) ?: continue
            if (base.depth > 120f || base.x < -140f || base.x > kit.w + 140f || base.y < -100f || base.y > kit.h + 160f) continue
            draws.add(PropDraw(base.depth) { drawFlora(canvas, f, base) })
        }
        for (n in g.world.nodes) {
            if (n.depleted) continue
            val h = g.world.terrain(n.x, n.z)
            val base = project(n.x, h, n.z) ?: continue
            if (base.depth > 95f || base.x < -140f || base.x > kit.w + 140f || base.y < -100f || base.y > kit.h + 160f) continue
            draws.add(PropDraw(base.depth) { drawResourceNode(canvas, n, base) })
        }
        for (f in g.world.fauna) {
            val h = g.world.terrain(f.x, f.z)
            val base = project(f.x, h, f.z) ?: continue
            if (base.depth > 100f || base.x < -140f || base.x > kit.w + 140f || base.y < -100f || base.y > kit.h + 160f) continue
            draws.add(PropDraw(base.depth) { drawFauna(canvas, f, base) })
        }
        for (s in g.world.sentinels) {
            if (!s.alive) continue
            val h = g.world.terrain(s.x, s.z)
            val base = project(s.x, h + 2.6f + sin(kit.time * 2.1f + s.phase) * 0.25f, s.z) ?: continue
            if (base.depth > 90f) continue
            draws.add(PropDraw(base.depth) { drawSentinel(canvas, s, base) })
        }
        val shipH = g.world.terrain(g.world.shipX, g.world.shipZ)
        val shipP = project(g.world.shipX, shipH + 0.6f, g.world.shipZ)
        if (shipP != null && shipP.depth < 130f) {
            draws.add(PropDraw(shipP.depth) { drawShip(canvas, shipP) })
        }
        val monoH = g.world.terrain(g.world.monolithX, g.world.monolithZ)
        val monoP = project(g.world.monolithX, monoH, g.world.monolithZ)
        if (monoP != null && monoP.depth < 150f) {
            draws.add(PropDraw(monoP.depth) { drawMonolith(canvas, monoP) })
        }
        draws.sortByDescending { it.depth }
        for (d in draws) d.draw(canvas)
    }

    private fun drawRock(canvas: Canvas, rock: Rock, p: Projected, seed: Int) {
        val r = (rock.size * p.scale * 0.55f).coerceIn(1.2f, kit.h * 0.22f)
        val tone = kit.mix(rock.tint, kit.dim(rock.tint, 0.35f), 0.4f)
        canvas.drawOval(RectF(p.x - r * 0.9f, p.y - r * 0.12f, p.x + r * 0.9f, p.y + r * 0.24f), kit.fill.apply {
            shader = null; style = Paint.Style.FILL; color = kit.alpha(dark, 90)
        })
        val path = Path()
        val n = 6
        for (i in 0 until n) {
            val a = i / n.toFloat() * PI.toFloat() * 2f + (seed % 10) * 0.2f
            val rr = r * (0.65f + 0.35f * Noise.value(rock.x + i, rock.z, seed + i))
            val px = p.x + cos(a) * rr
            val py = p.y - sin(a) * rr * 0.62f
            if (i == 0) path.moveTo(px, py) else path.lineTo(px, py)
        }
        path.close()
        kit.fill.shader = null
        kit.fill.style = Paint.Style.FILL
        kit.fill.color = tone
        canvas.drawPath(path, kit.fill)
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = 0.8f * kit.scale
        kit.stroke.color = kit.alpha(kit.mix(tone, cream, 0.35f), 65)
        canvas.drawPath(path, kit.stroke)
    }

    private fun drawFlora(canvas: Canvas, f: Flora, base: Projected) {
        val pxPerMeter = base.scale
        val height = (f.height * pxPerMeter).coerceIn(3f, kit.h * 0.58f)
        val width = (f.width * pxPerMeter).coerceIn(1f, kit.h * 0.15f)
        if (height < 3f) return
        val sway = sin(kit.time * 0.8f + f.sway) * width * 0.3f
        val topX = base.x + sway
        val topY = base.y - height
        val tint = f.tint
        kit.fill.shader = null
        kit.fill.style = Paint.Style.FILL
        kit.fill.color = kit.alpha(dark, 80)
        canvas.drawOval(RectF(base.x - width * 1.3f, base.y - height * 0.035f, base.x + width * 1.3f, base.y + height * 0.07f), kit.fill)
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = max(1.2f, width * (if (f.type == 1) 0.5f else 0.19f))
        kit.stroke.color = kit.mix(kit.dim(tint, 0.62f), 0xFF183028.toInt(), 0.4f)
        canvas.drawLine(base.x, base.y, topX, topY, kit.stroke)
        when (f.type) {
            0 -> {
                for (i in 0 until 5) {
                    val a = -PI.toFloat() * 0.9f + i * 0.38f + sin(kit.time + f.sway) * 0.05f
                    val lx = topX + cos(a) * width * 2.1f
                    val ly = topY + sin(a) * width * 1.3f + width * 0.35f
                    val c = kit.mix(tint, cream, 0.12f + i * 0.045f)
                    kit.stroke.style = Paint.Style.STROKE
                    kit.stroke.strokeWidth = max(1.5f, width * 0.3f)
                    kit.stroke.color = kit.alpha(c, 220)
                    canvas.drawLine(topX, topY + width * 0.45f, lx, ly, kit.stroke)
                    kit.fill.style = Paint.Style.FILL
                    kit.fill.color = kit.alpha(c, 185)
                    canvas.drawOval(RectF(lx - width * 0.62f, ly - width * 0.3f, lx + width * 0.62f, ly + width * 0.3f), kit.fill)
                }
            }
            1 -> {
                for (i in 0 until 4) {
                    val y = topY + height * (0.18f + i * 0.17f)
                    val dir = if (i % 2 == 0) 1f else -1f
                    kit.stroke.style = Paint.Style.STROKE
                    kit.stroke.strokeWidth = max(1.2f, width * 0.32f)
                    kit.stroke.color = kit.mix(tint, cream, 0.1f)
                    canvas.drawLine(base.x, y, base.x + dir * width * 1.6f, y - height * 0.08f, kit.stroke)
                }
                kit.fill.style = Paint.Style.FILL
                kit.fill.color = kit.alpha(tint, 170)
                canvas.drawCircle(topX, topY, width * 0.75f, kit.fill)
            }
            else -> {
                val capW = width * 2.5f
                kit.fill.style = Paint.Style.FILL
                kit.fill.shader = LinearGradient(
                    topX - capW, topY, topX + capW, topY,
                    intArrayOf(kit.alpha(tint, 110), kit.mix(tint, cream, 0.35f), kit.alpha(tint, 110)),
                    null, Shader.TileMode.CLAMP
                )
                canvas.drawOval(RectF(topX - capW, topY - capW * 0.55f, topX + capW, topY + capW * 0.45f), kit.fill)
                kit.fill.shader = null
                kit.fill.color = kit.alpha(kit.dim(tint, 0.5f), 120)
                canvas.drawOval(RectF(topX - capW * 0.75f, topY + width * 0.1f, topX + capW * 0.75f, topY + width * 0.5f), kit.fill)
            }
        }
    }

    private fun drawResourceNode(canvas: Canvas, n: ResourceNode, base: Projected) {
        val scale = base.scale
        val r = (n.size * scale * 0.5f).coerceIn(1f, kit.h * 0.3f)
        val tint = n.resource.color
        val glow = 0.5f + 0.5f * sin(kit.time * 2f + n.id)
        kit.radial(base.x, base.y - r * 0.4f, r * 3.4f, kit.alpha(tint, (30 + 28 * glow).toInt()), kit.alpha(tint, 0))
        kit.fill.style = Paint.Style.FILL
        kit.fill.color = kit.alpha(dark, 100)
        canvas.drawOval(RectF(base.x - r * 1.15f, base.y - r * 0.12f, base.x + r * 1.15f, base.y + r * 0.24f), kit.fill)
        when (n.shape) {
            NodeShape.CRYSTAL -> {
                for (i in -1..1) {
                    val ox = i * r * 0.38f
                    val hh = r * (1.6f - abs(i) * 0.35f)
                    val path = Path()
                    path.moveTo(base.x + ox, base.y - hh)
                    path.lineTo(base.x + ox + r * 0.24f, base.y - hh * 0.28f)
                    path.lineTo(base.x + ox + r * 0.14f, base.y)
                    path.lineTo(base.x + ox - r * 0.16f, base.y)
                    path.lineTo(base.x + ox - r * 0.25f, base.y - hh * 0.35f)
                    path.close()
                    kit.fill.shader = LinearGradient(
                        base.x + ox, base.y - hh, base.x + ox, base.y,
                        intArrayOf(kit.mix(tint, cream, 0.55f), tint, kit.dim(tint, 0.35f)),
                        null, Shader.TileMode.CLAMP
                    )
                    canvas.drawPath(path, kit.fill)
                    kit.fill.shader = null
                    kit.stroke.style = Paint.Style.STROKE
                    kit.stroke.strokeWidth = 0.8f * kit.scale
                    kit.stroke.color = kit.alpha(cream, 160)
                    canvas.drawPath(path, kit.stroke)
                }
            }
            NodeShape.ORE -> {
                val path = Path()
                path.moveTo(base.x - r, base.y)
                path.lineTo(base.x - r * 0.6f, base.y - r * 0.9f)
                path.lineTo(base.x - r * 0.05f, base.y - r * 1.15f)
                path.lineTo(base.x + r * 0.6f, base.y - r * 0.82f)
                path.lineTo(base.x + r, base.y)
                path.close()
                kit.fill.color = kit.mix(g.world.planet.biome.mid, tint, 0.35f)
                canvas.drawPath(path, kit.fill)
                kit.stroke.style = Paint.Style.STROKE
                kit.stroke.strokeWidth = max(1f, r * 0.1f)
                kit.stroke.color = kit.alpha(tint, 225)
                for (i in 0 until 3) {
                    canvas.drawLine(base.x - r * 0.5f + i * r * 0.35f, base.y - r * 0.1f, base.x - r * 0.2f + i * r * 0.3f, base.y - r * 0.8f, kit.stroke)
                }
            }
            NodeShape.PLANT -> {
                kit.stroke.style = Paint.Style.STROKE
                kit.stroke.strokeWidth = max(1.2f, r * 0.18f)
                kit.stroke.color = kit.mix(tint, 0xFF6BFFB0.toInt(), 0.25f)
                canvas.drawLine(base.x, base.y, base.x - r * 0.1f, base.y - r * 1.4f, kit.stroke)
                for (i in 0 until 4) {
                    val a = -1.2f + i * 0.7f
                    val lx = base.x + cos(a) * r * 1.1f
                    val ly = base.y - r * (0.7f + i * 0.2f) + sin(a) * r * 0.45f
                    canvas.drawLine(base.x, base.y - r * 0.7f, lx, ly, kit.stroke)
                    kit.fill.style = Paint.Style.FILL
                    kit.fill.color = kit.alpha(tint, 190)
                    canvas.drawCircle(lx, ly, r * 0.24f, kit.fill)
                }
            }
            NodeShape.POD -> {
                kit.fill.shader = LinearGradient(
                    base.x, base.y - r * 1.6f, base.x, base.y,
                    intArrayOf(kit.mix(tint, cream, 0.4f), tint, kit.dim(tint, 0.25f)),
                    null, Shader.TileMode.CLAMP
                )
                canvas.drawRoundRect(RectF(base.x - r * 0.55f, base.y - r * 1.7f, base.x + r * 0.55f, base.y - r * 0.08f), r * 0.4f, r * 0.4f, kit.fill)
                kit.fill.shader = null
                kit.stroke.style = Paint.Style.STROKE
                kit.stroke.color = kit.alpha(cream, 160)
                kit.stroke.strokeWidth = 1f * kit.scale
                canvas.drawRoundRect(RectF(base.x - r * 0.55f, base.y - r * 1.7f, base.x + r * 0.55f, base.y - r * 0.08f), r * 0.4f, r * 0.4f, kit.stroke)
                canvas.drawLine(base.x - r * 0.65f, base.y - r * 0.85f, base.x + r * 0.65f, base.y - r * 0.85f, kit.stroke)
            }
        }
        if (n.scanned || base.depth < 18f) {
            val label = "${n.resource.symbol} ${n.amount}"
            kit.text(label, base.x, base.y - r * 2.05f, (9f * kit.scale).coerceAtLeast(8f), kit.alpha(tint, 235), kit.monoBold, Paint.Align.CENTER)
            kit.circle(base.x, base.y - r * 2.25f, 2.2f * kit.scale, kit.alpha(tint, 180))
        }
        if (g.world.miningNode === n) {
            kit.circle(base.x, base.y - r * 0.4f, r * 1.4f, kit.alpha(tint, 180), Paint.Style.STROKE)
            kit.circle(base.x, base.y - r * 0.4f, r * 1.55f, kit.alpha(tint, 80), Paint.Style.STROKE)
        }
    }

    private fun drawFauna(canvas: Canvas, f: Fauna, base: Projected) {
        val r = (f.size * base.scale * 0.55f).coerceIn(0.8f, kit.h * 0.25f)
        val bob = sin(kit.time * 2.1f + f.phase) * r * 0.05f
        val body = RectF(base.x - r * 1.25f, base.y - r * 1.05f + bob, base.x + r * 1.0f, base.y - r * 0.18f + bob)
        kit.fill.style = Paint.Style.FILL
        kit.fill.shader = LinearGradient(
            body.left, body.top, body.right, body.bottom,
            intArrayOf(kit.mix(f.tint, cream, 0.2f), f.tint, kit.dim(f.tint, 0.4f)),
            null, Shader.TileMode.CLAMP
        )
        canvas.drawOval(body, kit.fill)
        kit.fill.shader = null
        val headX = base.x + r * (if (sin(f.angle) > 0) 0.9f else -0.95f)
        val headY = base.y - r * 1.0f + bob
        canvas.drawCircle(headX, headY, r * 0.38f, kit.fill.apply { color = f.tint; style = Paint.Style.FILL })
        kit.fill.color = kit.alpha(cream, 230)
        canvas.drawCircle(headX + r * 0.1f, headY - r * 0.08f, r * 0.07f, kit.fill)
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = max(1f, r * 0.11f)
        kit.stroke.color = kit.dim(f.tint, 0.55f)
        for (i in 0 until 4) {
            val lx = base.x + r * (-0.85f + i * 0.55f)
            val swing = sin(kit.time * 5f + i + f.phase) * r * 0.12f
            canvas.drawLine(lx, base.y - r * 0.35f, lx + swing, base.y, kit.stroke)
        }
        if (f.scanned && base.depth < 45f) {
            val tag = f.name.uppercase()
            kit.text(tag, base.x, base.y - r * 1.85f, (8.5f * kit.scale).coerceAtLeast(8f), kit.alpha(cyan, 220), kit.mono, Paint.Align.CENTER, 0.8f * kit.scale)
            kit.line(base.x - r * 0.4f, base.y - r * 1.7f, base.x + r * 0.4f, base.y - r * 1.7f, kit.alpha(cyan, 120), 0.7f)
        }
    }

    private fun drawSentinel(canvas: Canvas, s: Sentinel, base: Projected) {
        val r = (base.scale * 0.75f).coerceIn(2f, kit.h * 0.16f)
        val pulse = 0.55f + 0.45f * sin(kit.time * 4f + s.phase)
        kit.radial(base.x, base.y, r * 4.5f, kit.alpha(danger, (28 + 38 * pulse).toInt()), kit.alpha(danger, 0))
        val path = Path()
        path.moveTo(base.x, base.y - r)
        path.lineTo(base.x + r * 0.85f, base.y)
        path.lineTo(base.x, base.y + r)
        path.lineTo(base.x - r * 0.85f, base.y)
        path.close()
        kit.fill.style = Paint.Style.FILL
        kit.fill.color = kit.mix(0xFF202B36.toInt(), danger, 0.18f)
        canvas.drawPath(path, kit.fill)
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = max(1f, r * 0.09f)
        kit.stroke.color = kit.alpha(danger, 220)
        canvas.drawPath(path, kit.stroke)
        kit.fill.color = kit.alpha(danger, (170 + 60 * pulse).toInt())
        canvas.drawCircle(base.x, base.y, r * 0.28f, kit.fill)
        kit.stroke.color = kit.alpha(0xFFFFC0B0.toInt(), 190)
        canvas.drawOval(RectF(base.x - r * 1.25f, base.y - r * 0.26f, base.x + r * 1.25f, base.y + r * 0.26f), kit.stroke)
        if (base.depth < 35f) {
            kit.text("CENTINELA", base.x, base.y - r * 1.75f, (8.5f * kit.scale).coerceAtLeast(8f), kit.alpha(danger, 230), kit.monoBold, Paint.Align.CENTER, 1.5f * kit.scale)
            kit.text("${s.health.toInt()}%", base.x, base.y - r * 1.75f + 12f * kit.scale, (7.5f * kit.scale).coerceAtLeast(7f), kit.alpha(cream, 190), kit.mono, Paint.Align.CENTER)
        }
    }

    private fun drawShip(canvas: Canvas, p: Projected) {
        val scale = p.scale
        val r = (scale * 1.45f).coerceIn(2f, kit.h * 0.34f)
        val dist = Noise.distance(g.player.x, g.player.z, g.world.shipX, g.world.shipZ)
        val pulse = 0.5f + 0.5f * sin(kit.time * 1.9f)
        kit.fill.style = Paint.Style.FILL
        kit.fill.color = kit.alpha(cyan, 40)
        canvas.drawOval(RectF(p.x - r * 2.2f, p.y - r * 0.32f, p.x + r * 2.2f, p.y + r * 0.38f), kit.fill)
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = 1.2f * kit.scale
        kit.stroke.color = kit.alpha(cyan, (80 + 100 * pulse).toInt())
        canvas.drawOval(RectF(p.x - r * 2.2f, p.y - r * 0.32f, p.x + r * 2.2f, p.y + r * 0.38f), kit.stroke)

        val body = Path()
        body.moveTo(p.x, p.y - r * 0.2f)
        body.lineTo(p.x + r * 0.55f, p.y - r * 0.86f)
        body.lineTo(p.x + r * 1.35f, p.y - r * 0.95f)
        body.lineTo(p.x + r * 2.1f, p.y - r * 0.42f)
        body.lineTo(p.x + r * 1.15f, p.y + r * 0.3f)
        body.lineTo(p.x - r * 1.15f, p.y + r * 0.3f)
        body.lineTo(p.x - r * 2.1f, p.y - r * 0.42f)
        body.lineTo(p.x - r * 1.35f, p.y - r * 0.95f)
        body.lineTo(p.x - r * 0.55f, p.y - r * 0.86f)
        body.close()
        kit.fill.shader = LinearGradient(
            p.x - r, p.y - r, p.x + r, p.y + r,
            intArrayOf(kit.mix(cream, orange, 0.15f), 0xFFD7C7A7.toInt(), 0xFF3A3E44.toInt()),
            null, Shader.TileMode.CLAMP
        )
        canvas.drawPath(body, kit.fill)
        kit.fill.shader = null
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = 1f * kit.scale
        kit.stroke.color = kit.alpha(cream, 160)
        canvas.drawPath(body, kit.stroke)

        val cockpit = Path()
        cockpit.moveTo(p.x, p.y - r * 0.72f)
        cockpit.lineTo(p.x + r * 0.36f, p.y - r * 0.2f)
        cockpit.lineTo(p.x, p.y + r * 0.08f)
        cockpit.lineTo(p.x - r * 0.36f, p.y - r * 0.2f)
        cockpit.close()
        kit.fill.color = kit.alpha(cyan, 185)
        canvas.drawPath(cockpit, kit.fill)
        kit.fill.color = kit.alpha(orange, 225)
        canvas.drawRect(p.x - r * 1.85f, p.y + r * 0.08f, p.x - r * 1.55f, p.y + r * 0.24f, kit.fill)
        canvas.drawRect(p.x + r * 1.55f, p.y + r * 0.08f, p.x + r * 1.85f, p.y + r * 0.24f, kit.fill)
        if (dist < 30f) {
            kit.text("NAVE · ${dist.toInt()} m", p.x, p.y - r * 2.2f, (9f * kit.scale).coerceAtLeast(8f), kit.alpha(cyan, 220), kit.monoBold, Paint.Align.CENTER, 1.2f * kit.scale)
        }
    }

    private fun drawMonolith(canvas: Canvas, p: Projected) {
        val r = (p.scale * 3.2f).coerceIn(2f, kit.h * 0.35f)
        val h = r * 2.8f
        val base = p.y
        val path = Path()
        path.moveTo(p.x - r, base)
        path.lineTo(p.x - r * 0.7f, base - h)
        path.lineTo(p.x + r * 0.7f, base - h)
        path.lineTo(p.x + r, base)
        path.close()
        kit.fill.shader = LinearGradient(
            p.x - r, base, p.x + r, base - h,
            intArrayOf(0xFF10151E.toInt(), 0xFF222C36.toInt(), 0xFF080B11.toInt()),
            null, Shader.TileMode.CLAMP
        )
        canvas.drawPath(path, kit.fill)
        kit.fill.shader = null
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = 1.2f * kit.scale
        kit.stroke.color = kit.alpha(cyan, 110)
        canvas.drawPath(path, kit.stroke)
        for (i in 0 until 6) {
            val y = base - h * (0.18f + i * 0.12f)
            val alpha = (90 + 55 * sin(kit.time * 1.3f + i)).toInt()
            kit.line(p.x - r * 0.42f, y, p.x + r * 0.35f, y - r * 0.07f, kit.alpha(orange, alpha), 1.1f)
            kit.circle(p.x + r * (if (i % 2 == 0) 0.12f else -0.18f), y - r * 0.11f, 1.3f * kit.scale, kit.alpha(orange, alpha))
        }
        kit.radial(p.x, base - h * 0.55f, r * 3.2f, kit.alpha(cyan, 22), kit.alpha(cyan, 0))
    }

    private fun drawAtmosphere(canvas: Canvas) {
        val w = kit.w
        val h = kit.h
        kit.fill.shader = RadialGradient(
            w / 2f, h / 2f, h * 0.82f,
            intArrayOf(Color.TRANSPARENT, kit.alpha(dark, 50), kit.alpha(dark, 225)),
            floatArrayOf(0f, 0.63f, 1f), Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, w, h, kit.fill)
        kit.fill.shader = null

        val biome = g.world.planet.biome
        for (i in 0 until 26) {
            val x = (((i * 3571 + (g.world.planet.seed and 0xFFF)) % 10000) / 10000f) * w
            val y0 = (((i * 1877 + 523) % 10000) / 10000f) * h
            val y = (y0 + sin(kit.time * 0.5f + i) * 18f * kit.scale + h) % h
            val tw = 0.4f + 0.6f * (0.5f + 0.5f * sin(kit.time * 1.7f + i * 2f))
            kit.circle(x, y, (0.7f + (i % 4) * 0.32f) * kit.scale, kit.alpha(biome.accent, (90 * tw).toInt()))
        }
        if (g.damageFlash > 0.02f) {
            kit.fill.shader = RadialGradient(
                w / 2f, h / 2f, h * 0.75f,
                intArrayOf(Color.TRANSPARENT, kit.alpha(danger, (g.damageFlash * 125).toInt())),
                null, Shader.TileMode.CLAMP
            )
            canvas.drawRect(0f, 0f, w, h, kit.fill)
            kit.fill.shader = null
        }
        val hazard = biome.hazard
        if (hazard != HazardType.NONE) {
            val pulse = 0.5f + 0.5f * sin(kit.time * 1.2f)
            kit.fill.shader = RadialGradient(
                w / 2f, h / 2f, h * 0.78f,
                intArrayOf(Color.TRANSPARENT, kit.alpha(hazard.tint, (16 + 18 * pulse).toInt())),
                null, Shader.TileMode.CLAMP
            )
            canvas.drawRect(0f, 0f, w, h, kit.fill)
            kit.fill.shader = null
        }
    }


    private fun drawSurfaceHud(canvas: Canvas) {
        val w = kit.w
        val h = kit.h
        val s = kit.scale
        val m = 28f * s
        val sys = g.universe.currentSystem()
        val planet = g.world.planet
        val p = g.player

        kit.button("menu", m, m, 48f * s, 48f * s, "≡", ButtonStyle.ACTION, null, null, cyan)
        kit.glowPanel(m + 60f * s, m, 380f * s, 78f * s, planet.biome.accent)
        kit.text(sys.name.uppercase(), m + 78f * s, m + 27f * s, 15f * s, cream, kit.sansBold, Paint.Align.LEFT, 2.2f * s)
        kit.text("${planet.displayName} · ${planet.biome.label}", m + 78f * s, m + 46f * s, 9.5f * s, kit.alpha(cyan, 220), kit.mono, Paint.Align.LEFT, 0.8f * s)
        kit.text("${planet.weather} · ${planet.biome.hazard.label}", m + 78f * s, m + 63f * s, 9f * s, muted, kit.mono, Paint.Align.LEFT)
        kit.chip(m + 326f * s, m + 52f * s, 92f * s, 18f * s, "G${sys.starClass.label}-${sys.index}", sys.starClass.color, true)

        val barsX = m + 60f * s
        val barsY = m + 100f * s
        val barW = 270f * s
        kit.bar(barsX, barsY, barW, 9f * s, p.health, 100f, if (p.health < 30f) danger else 0xFFFF7B6B.toInt(), "VIDA", "${p.health.toInt()}%", "♥")
        kit.bar(barsX, barsY + 23f * s, barW, 8f * s, p.shield, 100f, 0xFF6EC8FF.toInt(), "ESCUDO", "${p.shield.toInt()}%", "◈")
        kit.bar(barsX, barsY + 46f * s, barW, 8f * s, p.hazard, 100f, planet.biome.hazard.tint, "PROTECCIÓN", "${p.hazard.toInt()}%", planet.biome.hazard.icon)
        kit.bar(barsX, barsY + 69f * s, barW, 8f * s, p.oxygen, 100f, cyan, "SOPORTE VITAL", "${p.oxygen.toInt()}%", "O₂")

        if (p.oxygen < 32f) {
            kit.button("recharge_oxygen", barsX + barW + 10f * s, barsY + 57f * s, 58f * s, 27f * s, "O₂+", ButtonStyle.SMALL, null, null, cyan)
        }
        if (p.hazard < 32f && planet.biome.hazard != HazardType.NONE) {
            kit.button("recharge_hazard", barsX + barW + 72f * s, barsY + 34f * s, 58f * s, 27f * s, "Na+", ButtonStyle.SMALL, null, null, yellow)
        }
        if (p.shield < 32f) {
            kit.button("recharge_shield", barsX + barW + 72f * s, barsY + 11f * s, 58f * s, 27f * s, "Fe+", ButtonStyle.SMALL, null, null, 0xFFB8C6D9.toInt())
        }

        drawCompass(canvas, w / 2f, m + 12f * s, 380f * s)

        kit.glowPanel(w - 370f * s, m, 342f * s, 74f * s, orange)
        kit.text("UNIDADES", w - 352f * s, m + 22f * s, 8.5f * s, muted, kit.mono, Paint.Align.LEFT, 1.2f * s)
        kit.text(formatNumber(p.units), w - 352f * s, m + 44f * s, 19f * s, cream, kit.monoBold, Paint.Align.LEFT)
        kit.text("NANITOS", w - 182f * s, m + 22f * s, 8.5f * s, muted, kit.mono, Paint.Align.LEFT, 1.2f * s)
        kit.text(formatNumber(p.nanites), w - 182f * s, m + 44f * s, 19f * s, cyan, kit.monoBold, Paint.Align.LEFT)
        kit.text("SALTO ${p.warpCells}  ·  LANZAMIENTO ${p.launchFuel}", w - 352f * s, m + 64f * s, 8f * s, kit.alpha(muted, 220), kit.mono, Paint.Align.LEFT, 0.7f * s)
        for (i in 0 until 5) {
            val locked = i < p.wanted
            kit.circle(w - 353f * s + i * 15f * s, m + 72f * s, 3.4f * s, if (locked) danger else kit.alpha(muted, 90))
        }

        kit.panel(w - 370f * s, m + 86f * s, 342f * s, 54f * s, kit.alpha(orange, 90), 0x9C071018.toInt(), 11f * s)
        kit.text("OBJETIVO", w - 352f * s, m + 104f * s, 8f * s, kit.alpha(orange, 220), kit.monoBold, Paint.Align.LEFT, 1.3f * s)
        kit.text(g.objectiveText(), w - 352f * s, m + 123f * s, 9.2f * s, cream, kit.mono, Paint.Align.LEFT)

        drawJoystick(canvas)
        drawActionButtons(canvas)
        drawCrosshair(canvas)
        drawMiningBeam(canvas)
        drawScanWave(canvas)

        val distToShip = Noise.distance(p.x, p.z, g.world.shipX, g.world.shipZ)
        if (distToShip < 8f) {
            kit.button("takeoff", w - 375f * s, h - 172f * s, 345f * s, 48f * s, "DESPEGAR A ÓRBITA", ButtonStyle.PRIMARY, "CONSUME 1 COMBUSTIBLE", "▲", orange)
        } else {
            kit.text("NAVE  ${distToShip.toInt()} m", w - 370f * s, h - 143f * s, 9.5f * s, kit.alpha(cyan, 210), kit.monoBold, Paint.Align.LEFT, 1.2f * s)
            kit.dashedLine(w - 370f * s, h - 136f * s, w - 310f * s, h - 136f * s, kit.alpha(cyan, 80), 0.8f)
        }

        val scanCharge = p.scannerCharges
        kit.text("ESCÁNER $scanCharge · ESCANEO ${(g.world.discoveredRatio() * 100).toInt()}%", m + 60f * s, h - 28f * s, 8.5f * s, kit.alpha(cyan, 170), kit.mono, Paint.Align.LEFT, 0.8f * s)
        kit.text("RADIO ${planet.radiusKm} km · GRAVEDAD 0.${(planet.seed ushr 8 and 0xF).toString(16)}g", m + 60f * s, h - 16f * s, 8f * s, kit.alpha(muted, 160), kit.mono, Paint.Align.LEFT)
    }

    private fun drawCompass(canvas: Canvas, cx: Float, y: Float, width: Float) {
        val s = kit.scale
        val heading = SurfaceWorld.yawDegrees(g.player.yaw)
        kit.line(cx - width / 2f, y, cx + width / 2f, y, kit.alpha(cyan, 70), 0.7f)
        val degPerTick = 15
        val start = (heading / degPerTick) * degPerTick - 90
        for (d in start..start + 180 step degPerTick) {
            val x = cx + ((d - heading) / 90f) * (width / 2f)
            if (x < cx - width / 2f || x > cx + width / 2f) continue
            val major = d % 45 == 0
            val norm = ((d % 360) + 360) % 360
            val label = when (norm) {
                0 -> "N"
                45 -> "NE"
                90 -> "E"
                135 -> "SE"
                180 -> "S"
                225 -> "SO"
                270 -> "O"
                315 -> "NO"
                else -> ""
            }
            if (major) {
                kit.line(x, y - 5f * s, x, y + 4f * s, kit.alpha(cream, 140), 0.8f)
                if (label.isNotEmpty()) {
                    kit.text(label, x, y - 9f * s, 8.2f * s, if (norm == 0) cyan else kit.alpha(cream, 190), kit.monoBold, Paint.Align.CENTER)
                }
            } else {
                kit.line(x, y, x, y + 2.4f * s, kit.alpha(muted, 80), 0.6f)
            }
        }
        val p = g.player
        val shipAngle = atan2(g.world.shipX - p.x, g.world.shipZ - p.z)
        val shipDelta = SurfaceWorld.angleDiff(shipAngle, p.yaw)
        if (abs(shipDelta) < PI.toFloat() * 0.9f) {
            val sx = cx + (shipDelta / (PI.toFloat() / 2f)) * (width / 2f)
            if (sx in cx - width / 2f..cx + width / 2f) {
                kit.circle(sx, y - 1f * s, 2.4f * s, orange)
                kit.text("▲", sx, y + 10f * s, 8f * s, orange, kit.sansBold, Paint.Align.CENTER)
            }
        }
        kit.line(cx, y - 7f * s, cx, y + 8f * s, kit.alpha(cyan, 190), 1.2f)
    }

    private fun drawJoystick(canvas: Canvas) {
        val s = kit.scale
        val cx = if (g.joystickActive) g.joystickBaseX else kit.w * 0.16f
        val cy = if (g.joystickActive) g.joystickBaseY else kit.h * 0.79f
        val r = g.joystickRadius
        kit.circle(cx, cy, r, kit.alpha(cyan, if (g.joystickActive) 50 else 22), Paint.Style.FILL)
        kit.circle(cx, cy, r, kit.alpha(cyan, if (g.joystickActive) 130 else 45), Paint.Style.STROKE)
        kit.circle(cx, cy, r * 0.62f, kit.alpha(cyan, 25), Paint.Style.STROKE)
        for (i in 0 until 4) {
            val a = i * PI.toFloat() / 2f
            kit.line(cx + cos(a) * r * 0.76f, cy + sin(a) * r * 0.76f, cx + cos(a) * r * 0.9f, cy + sin(a) * r * 0.9f, kit.alpha(cyan, 90), 0.8f)
        }
        val kx = cx + g.joystickX * r * 0.7f
        val ky = cy + g.joystickY * r * 0.7f
        kit.circle(kx, ky, r * 0.26f, kit.alpha(cyan, if (g.joystickActive) 150 else 70))
        kit.circle(kx, ky, r * 0.16f, kit.alpha(cream, 190))
        kit.text("MOVER", cx, cy + r + 16f * s, 8f * s, kit.alpha(cyan, if (g.joystickActive) 180 else 80), kit.mono, Paint.Align.CENTER, 1.5f * s)
    }

    private fun drawActionButtons(canvas: Canvas) {
        val s = kit.scale
        val w = kit.w
        val h = kit.h
        val bw = 90f * s
        val gap = 7f * s
        val total = bw * 4 + gap * 3
        val x = w - total - 28f * s
        val y = h - 78f * s
        val bh = 58f * s
        val p = g.player
        kit.button("scan", x, y, bw, bh, "ESCANEAR", ButtonStyle.ACTION, "${p.scannerCharges} CARGAS", "◎", cyan)
        kit.button("mine", x + bw + gap, y, bw, bh, "MINAR", ButtonStyle.ACTION, "MANTENER", "⛏", orange, hold = true)
        kit.button("jet", x + (bw + gap) * 2, y, bw, bh, "JETPACK", ButtonStyle.ACTION, "${p.jetpack.toInt()}%", "↑", 0xFFB78CFF.toInt(), hold = true)
        kit.button("shoot", x + (bw + gap) * 3, y, bw, bh, "DISPARAR", ButtonStyle.DANGER, if (p.wanted > 0) "ALERTA ${p.wanted}" else "MANTENER", "◉", danger, hold = true)
        kit.button("inventory", 28f * s, h - 58f * s, 94f * s, 34f * s, "INVENTARIO", ButtonStyle.SMALL, null, null, cream)
        kit.button("craft", 130f * s, h - 58f * s, 78f * s, 34f * s, "FABRICAR", ButtonStyle.SMALL, null, null, cyan)
    }

    private fun drawCrosshair(canvas: Canvas) {
        val s = kit.scale
        val cx = kit.w / 2f
        val cy = kit.h / 2f
        val node = g.world.aimNode(g.player)
        val sentinel = g.world.aimSentinel(g.player)
        val color = when {
            sentinel != null -> danger
            node != null -> node.resource.color
            else -> kit.alpha(cyan, 175)
        }
        val gap = 8f * s
        val len = 11f * s
        kit.line(cx - gap - len, cy, cx - gap, cy, color, 1.2f)
        kit.line(cx + gap, cy, cx + gap + len, cy, color, 1.2f)
        kit.line(cx, cy - gap - len, cx, cy - gap, color, 1.2f)
        kit.line(cx, cy + gap, cx, cy + gap + len, color, 1.2f)
        kit.circle(cx, cy, 2.1f * s, color)
        kit.circle(cx, cy, 20f * s, kit.alpha(color, 45), Paint.Style.STROKE)
        if (node != null) {
            kit.text("${node.resource.symbol} · ${node.resource.label.uppercase()}  ${node.amount}", cx, cy + 38f * s, 9f * s, node.resource.color, kit.monoBold, Paint.Align.CENTER, 0.7f * s)
            kit.text("VETA A ${Noise.distance(g.player.x, g.player.z, node.x, node.z).toInt()} m", cx, cy + 51f * s, 8f * s, kit.alpha(cream, 170), kit.mono, Paint.Align.CENTER)
        } else if (sentinel != null) {
            kit.text("CENTINELA · ${sentinel.health.toInt()}%", cx, cy + 38f * s, 9f * s, danger, kit.monoBold, Paint.Align.CENTER, 0.8f * s)
        } else if (g.world.miningNode != null) {
            kit.text("EXTRACCIÓN EN CURSO", cx, cy + 38f * s, 9f * s, orange, kit.monoBold, Paint.Align.CENTER, 0.8f * s)
        }
    }

    private fun drawMiningBeam(canvas: Canvas) {
        val node = g.world.miningNode ?: return
        val ground = g.world.terrain(node.x, node.z)
        val target = project(node.x, ground + node.size * 0.8f, node.z) ?: return
        val sx = kit.w * 0.62f
        val sy = kit.h * 0.93f
        val dx = target.x - sx
        val dy = target.y - sy
        val len = sqrt(dx * dx + dy * dy)
        if (len < 1f) return
        val nx = -dy / len
        val ny = dx / len
        val jag = sin(kit.time * 40f) * 5f * kit.scale
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = 8f * kit.scale
        kit.stroke.color = kit.alpha(orange, 35)
        canvas.drawLine(sx, sy, target.x, target.y, kit.stroke)
        kit.stroke.strokeWidth = 2.3f * kit.scale
        kit.stroke.color = kit.alpha(node.resource.color, 220)
        val path = Path()
        path.moveTo(sx, sy)
        path.quadTo((sx + target.x) / 2f + nx * jag, (sy + target.y) / 2f + ny * jag, target.x, target.y)
        canvas.drawPath(path, kit.stroke)
        kit.radial(target.x, target.y, 32f * kit.scale, kit.alpha(node.resource.color, 120), kit.alpha(node.resource.color, 0))
        for (i in 0 until 6) {
            val a = kit.time * 8f + i * 1.1f
            val rr = (8f + (i % 3) * 5f) * kit.scale
            kit.circle(target.x + cos(a) * rr, target.y + sin(a) * rr, 1.2f * kit.scale, kit.alpha(node.resource.color, 180))
        }
        if (g.world.miningProgress > 0f) {
            kit.bar(kit.w / 2f - 80f * kit.scale, kit.h * 0.69f, 160f * kit.scale, 4f * kit.scale, g.world.miningProgress, 0.52f, node.resource.color, "EXTRACCIÓN", "")
        }
    }

    private fun drawScanWave(canvas: Canvas) {
        if (g.scanEffect <= 0f) return
        val cx = kit.w / 2f
        val cy = kit.h / 2f
        val r = (1f - g.scanEffect) * kit.h * 0.72f
        val a = (g.scanEffect * 190).toInt()
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = 2f * kit.scale
        kit.stroke.color = kit.alpha(cyan, a)
        canvas.drawCircle(cx, cy, r, kit.stroke)
        kit.stroke.strokeWidth = 1f * kit.scale
        kit.stroke.color = kit.alpha(cyan, a / 2)
        canvas.drawCircle(cx, cy, r * 0.72f, kit.stroke)
        for (i in 0 until 12) {
            val ang = i * PI.toFloat() / 6f + kit.time * 0.2f
            kit.line(cx + cos(ang) * r, cy + sin(ang) * r, cx + cos(ang) * (r + 14f * kit.scale), cy + sin(ang) * (r + 14f * kit.scale), kit.alpha(cyan, a), 1f)
        }
    }

    private fun drawToast(canvas: Canvas) {
        val s = kit.scale
        val text = g.toastText
        val alpha = min(1f, g.toastTime / 0.6f)
        val width = min(kit.w * 0.46f, 640f * s)
        val x = kit.w / 2f - width / 2f
        val y = kit.h * 0.14f
        kit.panel(x, y, width, 40f * s, kit.alpha(g.toastAccent, (180 * alpha).toInt()), kit.alpha(0xFF071018.toInt(), (215 * alpha).toInt()), 10f * s)
        kit.text(text, kit.w / 2f, y + 25f * s, 10.5f * s, kit.alpha(cream, (245 * alpha).toInt()), kit.monoBold, Paint.Align.CENTER, 0.3f * s)
        kit.fill.color = kit.alpha(g.toastAccent, (180 * alpha).toInt())
        canvas.drawRect(x + 8f * s, y + 10f * s, x + 11f * s, y + 30f * s, kit.fill)
    }

    private fun formatNumber(value: Int): String {
        return String.format("%,d", value).replace(',', '.')
    }


    private fun drawSpace(canvas: Canvas, controls: Boolean = true) {
        val w = kit.w
        val h = kit.h
        val s = kit.scale
        val sys = g.universe.currentSystem()
        val seed = sys.seed
        kit.fill.shader = LinearGradient(
            0f, 0f, w, h,
            intArrayOf(0xFF03050B.toInt(), 0xFF0A1220.toInt(), 0xFF120B18.toInt(), 0xFF03050B.toInt()),
            null, Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, w, h, kit.fill)
        kit.fill.shader = null
        kit.radial(w * 0.79f, h * 0.3f, h * 0.5f, kit.alpha(sys.starClass.color, 46), kit.alpha(sys.starClass.color, 0))
        kit.radial(w * 0.14f, h * 0.72f, h * 0.55f, kit.alpha(0xFF286A9C.toInt(), 56), kit.alpha(0xFF286A9C.toInt(), 0))
        kit.radial(w * 0.55f, h * 0.06f, h * 0.45f, kit.alpha(0xFF8D2D5C.toInt(), 30), kit.alpha(0xFF8D2D5C.toInt(), 0))
        for (i in 0 until 260) {
            val sx = ((i * 1543 + (seed and 0xFFF)) % 10000) / 10000f
            val sy = ((i * 7919 + ((seed ushr 8) and 0xFFF)) % 10000) / 10000f
            val x = ((sx + kit.time * 0.002f * (1 + i % 3)) % 1f) * w
            val y = sy * h
            val tw = 0.4f + 0.6f * (0.5f + 0.5f * sin(kit.time * 0.6f + i))
            kit.circle(x, y, (0.35f + (i % 4) * 0.3f) * s, kit.alpha(cream, (95 * tw).toInt()))
        }

        val starX = w * 0.81f
        val starY = h * 0.31f
        val starR = h * (0.075f + (sys.index % 3) * 0.008f)
        kit.radial(starX, starY, starR * 5.4f, kit.alpha(sys.starClass.color, 54), kit.alpha(sys.starClass.color, 0))
        kit.radial(starX, starY, starR * 1.35f, kit.alpha(0xFFFFFFFF.toInt(), 235), kit.alpha(sys.starClass.color, 160))
        kit.circle(starX, starY, starR, sys.starClass.color)

        for (i in 0 until 4) {
            val orbitR = starR * (2.1f + i * 0.95f)
            kit.stroke.style = Paint.Style.STROKE
            kit.stroke.strokeWidth = 0.9f * s
            kit.stroke.color = kit.alpha(sys.starClass.color, 26 + i * 8)
            canvas.drawOval(RectF(starX - orbitR, starY - orbitR * 0.38f, starX + orbitR, starY + orbitR * 0.38f), kit.stroke)
        }

        val currentPlanet = g.universe.currentPlanet()
        val planetRadius = h * 0.64f
        val bigX = -w * 0.02f
        val bigY = h * 1.34f
        kit.radial(bigX, bigY, planetRadius * 1.1f, kit.alpha(currentPlanet.biome.high, 72), kit.alpha(currentPlanet.biome.high, 0))
        kit.fill.shader = RadialGradient(
            bigX - planetRadius * 0.3f, bigY - planetRadius * 0.4f, planetRadius * 1.25f,
            intArrayOf(kit.mix(currentPlanet.biome.high, cream, 0.22f), currentPlanet.biome.mid, currentPlanet.biome.low, 0xFF03060C.toInt()),
            floatArrayOf(0f, 0.33f, 0.68f, 1f), Shader.TileMode.CLAMP
        )
        canvas.drawCircle(bigX, bigY, planetRadius, kit.fill)
        kit.fill.shader = null
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = 2f * s
        kit.stroke.color = kit.alpha(currentPlanet.biome.accent, 100)
        canvas.drawCircle(bigX, bigY, planetRadius * 1.01f, kit.stroke)
        kit.stroke.strokeWidth = 7f * s
        kit.stroke.color = kit.alpha(currentPlanet.biome.accent, 16)
        canvas.drawCircle(bigX, bigY, planetRadius * 1.035f, kit.stroke)

        for (i in 0 until sys.planets.size) {
            val planet = sys.planets[i]
            val angle = (seed % 360) * 0.017f + i * 1.73f + kit.time * 0.008f
            val orbit = starR * (2.1f + i * 0.95f)
            val px = starX + cos(angle) * orbit
            val py = starY + sin(angle) * orbit * 0.38f
            val pr = (9f + (planet.radiusKm % 23)) * s * 0.9f
            if (i == g.universe.currentPlanetIndex) {
                kit.circle(px, py, pr * 2f, kit.alpha(cyan, 42))
                kit.circle(px, py, pr * 1.55f, kit.alpha(cyan, 170), Paint.Style.STROKE)
            }
            kit.fill.shader = RadialGradient(
                px - pr * 0.3f, py - pr * 0.35f, pr * 1.5f,
                intArrayOf(kit.mix(planet.biome.high, cream, 0.35f), planet.biome.mid, kit.dim(planet.biome.low, 0.45f)),
                null, Shader.TileMode.CLAMP
            )
            canvas.drawCircle(px, py, pr, kit.fill)
            kit.fill.shader = null
            kit.chip(px - 58f * s, py + pr + 7f * s, 116f * s, 17f * s, planet.displayName.take(17).uppercase(), planet.biome.accent, i == g.universe.currentPlanetIndex)
        }

        val stationX = w * 0.69f
        val stationY = h * 0.72f
        val stationR = 22f * s
        kit.circle(stationX, stationY, stationR * 2.7f, kit.alpha(cyan, 25))
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = 2f * s
        kit.stroke.color = kit.alpha(cream, 160)
        canvas.drawCircle(stationX, stationY, stationR, kit.stroke)
        canvas.drawCircle(stationX, stationY, stationR * 0.42f, kit.stroke)
        for (i in 0 until 6) {
            val a = i * PI.toFloat() / 3f + kit.time * 0.1f
            canvas.drawLine(
                stationX + cos(a) * stationR * 0.45f, stationY + sin(a) * stationR * 0.45f,
                stationX + cos(a) * stationR, stationY + sin(a) * stationR,
                kit.stroke
            )
        }
        kit.fill.color = kit.alpha(cyan, 120)
        canvas.drawCircle(stationX, stationY, stationR * 0.2f, kit.fill)
        kit.text(sys.stationName.uppercase(), stationX, stationY + stationR + 18f * s, 8.5f * s, kit.alpha(cyan, 200), kit.monoBold, Paint.Align.CENTER, 0.9f * s)

        if (!controls) {
            kit.fill.color = kit.alpha(dark, 140)
            canvas.drawRect(0f, 0f, w, h, kit.fill)
            drawHelmetCorners(canvas, 0.3f)
            return
        }

        val m = 28f * s
        kit.button("menu", m, m, 48f * s, 48f * s, "≡", ButtonStyle.ACTION, null, null, cyan)
        kit.glowPanel(m + 60f * s, m, 420f * s, 86f * s, sys.starClass.color)
        kit.text("SISTEMA ${sys.name.uppercase()}", m + 78f * s, m + 28f * s, 18f * s, cream, kit.sansBold, Paint.Align.LEFT, 2f * s)
        kit.text("${sys.starClass.label} · ${sys.economy.label.uppercase()} · ${sys.wealthLabel.uppercase()}", m + 78f * s, m + 48f * s, 9.5f * s, sys.starClass.color, kit.monoBold, Paint.Align.LEFT, 0.9f * s)
        kit.text("CONFLICTO ${sys.conflictLabel.uppercase()} · ${sys.planets.size} PLANETAS · ${sys.distance} ALY", m + 78f * s, m + 66f * s, 8.5f * s, muted, kit.mono, Paint.Align.LEFT, 0.5f * s)
        kit.text("MODO ÓRBITA · PROPULSIÓN ESTABLE", m + 78f * s, m + 80f * s, 8f * s, kit.alpha(cyan, 150), kit.mono, Paint.Align.LEFT)

        drawCompass(canvas, w / 2f, m + 12f * s, 380f * s)
        kit.glowPanel(w - 340f * s, m, 312f * s, 74f * s, orange)
        kit.text("UNIDADES", w - 322f * s, m + 22f * s, 8.5f * s, muted, kit.mono, Paint.Align.LEFT, 1.2f * s)
        kit.text(formatNumber(g.player.units), w - 322f * s, m + 44f * s, 19f * s, cream, kit.monoBold, Paint.Align.LEFT)
        kit.text("NANITOS ${formatNumber(g.player.nanites)}", w - 160f * s, m + 42f * s, 13f * s, cyan, kit.monoBold, Paint.Align.LEFT)
        kit.text("SALTO ${g.player.warpCells} · HD ${'A' + g.player.hyperdriveLevel}", w - 322f * s, m + 64f * s, 8f * s, kit.alpha(muted, 220), kit.mono, Paint.Align.LEFT)

        kit.text("DESTINOS ORBITALES", m + 60f * s, h * 0.31f, 9f * s, kit.alpha(cyan, 200), kit.monoBold, Paint.Align.LEFT, 1.7f * s)
        for (i in sys.planets.indices) {
            val planet = sys.planets[i]
            val selected = i == g.selectedPlanet
            val bx = m + 60f * s
            val by = h * 0.34f + i * 45f * s
            kit.button(
                "planet:$i", bx, by, 274f * s, 38f * s,
                planet.displayName.uppercase(),
                if (selected) ButtonStyle.PRIMARY else ButtonStyle.TAB,
                "${planet.biome.label} · ${planet.weather}",
                if (selected) "◉" else "○",
                planet.biome.accent
            )
        }

        val bw = 245f * s
        val bh = 48f * s
        val bx = w - bw - 28f * s
        val by = h - bh - 28f * s
        kit.button("galaxy", bx - bw - 10f * s, by, bw, bh, "MAPA GALÁCTICO", ButtonStyle.ACTION, "RUTA AL NÚCLEO", "⌬", cream)
        kit.button("station", bx - bw - 10f * s, by - bh - 10f * s, bw, bh, "ESTACIÓN", ButtonStyle.ACTION, sys.stationName.uppercase(), "◈", cyan)
        kit.button("warp", bx, by, bw, bh, "HIPERSALTO", ButtonStyle.DANGER, "SIGUIENTE SISTEMA · 1 CÉLULA", "ϟ", orange)
        kit.button("land", bx, by - bh - 10f * s, bw, bh, "ATERRIZAR", ButtonStyle.PRIMARY, sys.planets[g.selectedPlanet].biome.label.uppercase(), "▼", sys.planets[g.selectedPlanet].biome.accent)
        kit.text("MANTÉN PULSADO UN DESTINO PARA ANALIZARLO", m + 60f * s, h - 32f * s, 8.5f * s, kit.alpha(muted, 170), kit.mono, Paint.Align.LEFT, 1.2f * s)
        drawHelmetCorners(canvas, 0.7f)
    }

    private fun drawGalaxy(canvas: Canvas) {
        val w = kit.w
        val h = kit.h
        val s = kit.scale
        val m = 32f * s
        kit.fill.color = kit.alpha(dark, 220)
        canvas.drawRect(0f, 0f, w, h, kit.fill)
        kit.radial(w * 0.32f, h * 0.52f, h * 0.9f, kit.alpha(0xFF3C2C8C.toInt(), 48), kit.alpha(0xFF3C2C8C.toInt(), 0))
        kit.radial(w * 0.55f, h * 0.44f, h * 0.2f, kit.alpha(0xFFFFE7B0.toInt(), 100), kit.alpha(0xFFFFE7B0.toInt(), 0))
        for (i in 0 until 80) {
            val a = i / 80f * PI.toFloat() * 2f
            val rr = h * (0.16f + (i % 13) * 0.022f)
            kit.circle(w * 0.55f + cos(a) * rr * 1.9f, h * 0.48f + sin(a) * rr * 0.44f, 0.7f * s, kit.alpha(cream, 80))
        }
        kit.text("MAPA GALÁCTICO", m + 38f * s, m + 38f * s, 26f * s, cream, kit.sansBold, Paint.Align.LEFT, 4f * s)
        kit.text("RUTA AL NÚCLEO  ·  171 428 AÑOS LUZ  ·  SEMILLA ${java.lang.Long.toHexString(g.galaxySeed).uppercase()}", m + 40f * s, m + 61f * s, 9.5f * s, kit.alpha(cyan, 190), kit.mono, Paint.Align.LEFT, 1.2f * s)
        kit.button("close", w - 138f * s, m, 104f * s, 38f * s, "CERRAR", ButtonStyle.GHOST, null, "×", cream)

        val indices = g.universe.nearbySystemIndices(9)
        val gridX = m + 40f * s
        val gridY = m + 94f * s
        val cardW = w * 0.185f
        val cardH = 63f * s
        val gap = 12f * s
        for ((n, index) in indices.withIndex()) {
            val sys = g.universe.systemAt(index)
            val col = n % 3
            val row = n / 3
            val bx = gridX + col * (cardW + gap)
            val by = gridY + row * (cardH + gap)
            val selected = index == g.galaxySelection
            kit.button(
                "system:$index", bx, by, cardW, cardH,
                sys.name.uppercase(),
                if (selected) ButtonStyle.PRIMARY else ButtonStyle.ACTION,
                "${sys.starClass.label} · ${sys.economy.label} · ${sys.planets.size} P",
                if (index == g.universe.currentSystemIndex) "◉" else "✦",
                sys.starClass.color
            )
        }

        val sys = g.universe.systemAt(g.galaxySelection)
        val px = w * 0.69f
        val py = m + 94f * s
        val pw = w * 0.285f - m
        kit.glowPanel(px, py, pw, h - py - m, sys.starClass.color)
        kit.text("DESTINO SELECCIONADO", px + 20f * s, py + 26f * s, 8.5f * s, kit.alpha(sys.starClass.color, 220), kit.monoBold, Paint.Align.LEFT, 1.4f * s)
        kit.text(sys.name.uppercase(), px + 20f * s, py + 57f * s, 22f * s, cream, kit.sansBold, Paint.Align.LEFT, 1.2f * s)
        kit.text("${sys.starClass.label}  ·  ${sys.starClass.description}", px + 20f * s, py + 76f * s, 9f * s, kit.alpha(cream, 185), kit.mono, Paint.Align.LEFT)
        kit.line(px + 20f * s, py + 90f * s, px + pw - 20f * s, py + 90f * s, kit.alpha(sys.starClass.color, 90), 1f)
        kit.keyValue(px + 20f * s, py + 112f * s, "ECONOMÍA", sys.economy.label)
        kit.keyValue(px + 20f * s, py + 132f * s, "RIQUEZA", sys.wealthLabel)
        kit.keyValue(px + 20f * s, py + 152f * s, "CONFLICTO", sys.conflictLabel)
        kit.keyValue(px + 20f * s, py + 172f * s, "PLANETAS", sys.planets.size.toString())
        kit.keyValue(px + 20f * s, py + 192f * s, "DISTANCIA", "${sys.index - g.universe.currentSystemIndex} saltos")
        kit.keyValue(px + 20f * s, py + 212f * s, "HIPERIMPULSOR", "Clase ${'A' + g.player.hyperdriveLevel} / req. ${sys.starClass.warpRequirement}")
        kit.text(
            if (g.player.hyperdriveLevel >= sys.starClass.warpRequirement) "RUTA COMPATIBLE" else "RUTA BLOQUEADA",
            px + 20f * s, py + 242f * s, 10f * s,
            if (g.player.hyperdriveLevel >= sys.starClass.warpRequirement) cyan else danger,
            kit.monoBold, Paint.Align.LEFT, 1.5f * s
        )
        val canWarp = sys.index != g.universe.currentSystemIndex
        kit.button(
            "warp", px + 20f * s, py + h - py - m - 78f * s, pw - 40f * s, 48f * s,
            "TRAZAR SALTO", ButtonStyle.PRIMARY,
            "1 CÉLULA · ${sys.starClass.label} REQUIERE HD ${sys.starClass.warpRequirement}",
            "ϟ", sys.starClass.color, enabled = canWarp
        )
        kit.text("Los sistemas azules contienen tecnología ancestral.", px + 20f * s, py + h - py - m - 18f * s, 8.5f * s, kit.alpha(muted, 180), kit.mono, Paint.Align.LEFT)
        drawHelmetCorners(canvas, 0.8f)
    }

    private fun drawStation(canvas: Canvas) {
        val w = kit.w
        val h = kit.h
        val s = kit.scale
        val sys = g.universe.currentSystem()
        kit.fill.color = kit.alpha(dark, 170)
        canvas.drawRect(0f, 0f, w, h, kit.fill)
        val x = w * 0.07f
        val y = h * 0.09f
        val pw = w * 0.86f
        val ph = h * 0.78f
        kit.glowPanel(x, y, pw, ph, cyan)
        kit.text("ESTACIÓN ORBITAL", x + 30f * s, y + 37f * s, 24f * s, cream, kit.sansBold, Paint.Align.LEFT, 3f * s)
        kit.text(sys.stationName.uppercase(), x + 30f * s, y + 56f * s, 9.5f * s, kit.alpha(cyan, 220), kit.monoBold, Paint.Align.LEFT, 1.4f * s)
        kit.text("${sys.economy.label.uppercase()} · ${sys.wealthLabel.uppercase()} · ${sys.conflictLabel.uppercase()}", x + 30f * s, y + 72f * s, 8.5f * s, muted, kit.mono, Paint.Align.LEFT)
        kit.button("close", x + pw - 126f * s, y + 20f * s, 96f * s, 34f * s, "SALIR", ButtonStyle.GHOST, null, "×", cream)

        val col1 = x + 30f * s
        val col2 = x + pw * 0.48f
        val top = y + 104f * s
        kit.text("COMERCIO DE RECURSOS", col1, top, 9f * s, kit.alpha(cyan, 210), kit.monoBold, Paint.Align.LEFT, 1.6f * s)
        kit.text("SERVICIOS DEL NEXO", col2, top, 9f * s, kit.alpha(orange, 210), kit.monoBold, Paint.Align.LEFT, 1.6f * s)
        kit.line(col1, top + 8f * s, x + pw * 0.44f, top + 8f * s, kit.alpha(cyan, 80), 1f)
        kit.line(col2, top + 8f * s, x + pw - 30f * s, top + 8f * s, kit.alpha(orange, 80), 1f)

        val commodities = (g.world.planet.resources + listOf(ResourceType.CARBON, ResourceType.FERRITE, ResourceType.OXYGEN, ResourceType.SODIUM)).distinct().take(5)
        for ((i, r) in commodities.withIndex()) {
            val ry = top + 24f * s + i * 52f * s
            kit.circle(col1 + 12f * s, ry + 12f * s, 9f * s, kit.alpha(r.color, 60))
            kit.text(r.symbol, col1 + 12f * s, ry + 17f * s, 9f * s, r.color, kit.monoBold, Paint.Align.CENTER)
            kit.text(r.label.uppercase(), col1 + 30f * s, ry + 10f * s, 10f * s, cream, kit.sansBold, Paint.Align.LEFT, 0.8f * s)
            kit.text("${g.player.amount(r)} EN CARGUERO · ${r.basePrice} u", col1 + 30f * s, ry + 24f * s, 8f * s, muted, kit.mono, Paint.Align.LEFT)
            kit.button("buy:${r.name}", col1 + 178f * s, ry - 2f * s, 74f * s, 24f * s, "COMPRAR ×5", ButtonStyle.SMALL, null, null, r.color)
            kit.button("sell:${r.name}", col1 + 258f * s, ry - 2f * s, 70f * s, 24f * s, "VENDER ×5", ButtonStyle.SMALL, null, null, cream)
        }

        val services = listOf(
            Triple("upgrade:hyperdrive", "HIPERIMPULSOR", "Mejora de rango estelar · ${120 + g.player.hyperdriveLevel * 160} nanitos"),
            Triple("upgrade:scanner", "ESCÁNER", "Nivel ${g.player.scannerLevel + 1} y 2 cargas · 40 nanitos"),
            Triple("upgrade:warp", "CÉLULA DE SALTO", "+1 célula de deformación · 60 nanitos"),
            Triple("upgrade:fuel", "COMBUSTIBLE", "+1 carga de lanzamiento · 30 nanitos")
        )
        for ((i, service) in services.withIndex()) {
            val (action, title, desc) = service
            val ry = top + 24f * s + i * 65f * s
            kit.panel(col2, ry, x + pw - 30f * s - col2, 52f * s, kit.alpha(orange, 80), 0x88081018.toInt(), 8f * s)
            kit.text(title, col2 + 14f * s, ry + 19f * s, 10f * s, cream, kit.sansBold, Paint.Align.LEFT, 0.9f * s)
            kit.text(desc, col2 + 14f * s, ry + 34f * s, 8f * s, muted, kit.mono, Paint.Align.LEFT)
            kit.button(action, col2 + (x + pw - 30f * s - col2) - 98f * s, ry + 12f * s, 82f * s, 27f * s, "ADQUIRIR", ButtonStyle.SMALL, null, null, orange)
        }

        val sy = y + ph - 90f * s
        kit.panel(col2, sy, x + pw - 30f * s - col2, 54f * s, kit.alpha(cyan, 80), 0x88081018.toInt(), 8f * s)
        kit.text("NANITOS DISPONIBLES", col2 + 14f * s, sy + 20f * s, 8f * s, muted, kit.mono, Paint.Align.LEFT, 1.2f * s)
        kit.text(formatNumber(g.player.nanites), col2 + 14f * s, sy + 43f * s, 18f * s, cyan, kit.monoBold, Paint.Align.LEFT)
        drawHelmetCorners(canvas, 0.6f)
    }


    private fun drawInventory(canvas: Canvas) {
        val w = kit.w
        val h = kit.h
        val s = kit.scale
        kit.fill.color = kit.alpha(dark, 190)
        canvas.drawRect(0f, 0f, w, h, kit.fill)
        val x = w * 0.055f
        val y = h * 0.075f
        val pw = w * 0.89f
        val ph = h * 0.84f
        kit.glowPanel(x, y, pw, ph, cyan)
        kit.text("EXOTRAJE // INVENTARIO", x + 28f * s, y + 38f * s, 25f * s, cream, kit.sansBold, Paint.Align.LEFT, 3f * s)
        kit.text("CAPACIDAD ${g.player.totalResources()} / 999  ·  RANURAS SINÉRGICAS 8 / 12", x + 30f * s, y + 57f * s, 9f * s, kit.alpha(cyan, 210), kit.mono, Paint.Align.LEFT, 1f * s)
        kit.button("close", x + pw - 122f * s, y + 20f * s, 94f * s, 34f * s, "VOLVER", ButtonStyle.GHOST, null, "×", cream)
        kit.button("craft", x + pw - 278f * s, y + 20f * s, 144f * s, 34f * s, "FABRICAR", ButtonStyle.PRIMARY, null, "⌬", cyan)

        val titleY = y + 92f * s
        kit.text("RECURSOS DEL EXOTRAJE", x + 30f * s, titleY, 9f * s, kit.alpha(cyan, 210), kit.monoBold, Paint.Align.LEFT, 1.7f * s)
        val gridX = x + 30f * s
        val gridY = titleY + 14f * s
        val slotW = (pw * 0.54f - 18f * s) / 3f
        val slotH = 64f * s
        val gap = 8f * s
        val resources = ResourceType.entries
        for ((i, r) in resources.withIndex()) {
            val col = i % 3
            val row = i / 3
            val sx = gridX + col * (slotW + gap)
            val sy = gridY + row * (slotH + gap)
            val amount = g.player.amount(r)
            kit.panel(sx, sy, slotW, slotH, kit.alpha(r.color, if (amount > 0) 120 else 40), 0x99070F16.toInt(), 8f * s)
            kit.circle(sx + 24f * s, sy + 30f * s, 16f * s, kit.alpha(r.color, 35))
            kit.text(r.symbol, sx + 24f * s, sy + 35f * s, 11f * s, r.color, kit.monoBold, Paint.Align.CENTER)
            kit.text(r.label.uppercase(), sx + 46f * s, sy + 20f * s, 9f * s, cream, kit.sansBold, Paint.Align.LEFT, 0.4f * s)
            kit.text("${amount} unidades", sx + 46f * s, sy + 36f * s, 8.5f * s, kit.alpha(r.color, 220), kit.mono, Paint.Align.LEFT)
            kit.text(r.short, sx + 46f * s, sy + 50f * s, 7.5f * s, kit.alpha(muted, 180), kit.mono, Paint.Align.LEFT)
        }

        val rightX = x + pw * 0.60f
        kit.text("TECNOLOGÍA Y SINERGIA", rightX, titleY, 9f * s, kit.alpha(orange, 220), kit.monoBold, Paint.Align.LEFT, 1.7f * s)
        val techY = titleY + 14f * s
        val techItems = listOf(
            Triple("MULTIHERRAMIENTA", "Nivel ${g.player.miningLevel} · extracción ${g.player.miningLevel}", 0xFFFF7B4D.toInt()),
            Triple("HIPERIMPULSOR", "Clase ${'A' + g.player.hyperdriveLevel} · alcance ${g.player.hyperdriveLevel + 1}", 0xFF6EC8FF.toInt()),
            Triple("ESCÁNER", "Nivel ${g.player.scannerLevel} · ${g.player.scannerCharges} cargas", 0xFF37F2D4.toInt()),
            Triple("TRAJE", "Escudo ${g.player.shield.toInt()}% · O₂ ${g.player.oxygen.toInt()}%", 0xFF5EF2A1.toInt())
        )
        for ((i, item) in techItems.withIndex()) {
            val (name, desc, col) = item
            val ty = techY + i * 46f * s
            kit.panel(rightX, ty, pw * 0.345f, 38f * s, kit.alpha(col, 90), 0x99070F16.toInt(), 7f * s)
            kit.text(name, rightX + 14f * s, ty + 16f * s, 9f * s, cream, kit.sansBold, Paint.Align.LEFT, 0.9f * s)
            kit.text(desc, rightX + 14f * s, ty + 29f * s, 8f * s, kit.alpha(col, 220), kit.mono, Paint.Align.LEFT)
            kit.circle(rightX + pw * 0.345f - 18f * s, ty + 19f * s, 5f * s, kit.alpha(col, 170))
        }
        val techBottom = techY + 4 * 46f * s + 4f * s
        kit.text("MÓDULOS ADYACENTES", rightX, techBottom + 18f * s, 8.5f * s, kit.alpha(cyan, 200), kit.mono, Paint.Align.LEFT, 1.3f * s)
        for (i in 0 until 6) {
            val hx = rightX + 22f * s + i * 48f * s
            val hy = techBottom + 44f * s
            drawHex(canvas, hx, hy, 17f * s, if (i < 4) cyan else muted, i < 4)
            kit.text(listOf("C", "Fe", "Na", "O₂", "H₂", "Cu")[i], hx, hy + 3f * s, 7.5f * s, if (i < 4) cream else muted, kit.monoBold, Paint.Align.CENTER)
        }
        kit.text("Conecta módulos del mismo color para obtener bonificaciones de sinergia.", rightX, techBottom + 82f * s, 8f * s, kit.alpha(muted, 190), kit.mono, Paint.Align.LEFT)

        kit.panel(x + 30f * s, y + ph - 95f * s, pw - 60f * s, 64f * s, kit.alpha(cyan, 70), 0x66081018.toInt(), 9f * s)
        kit.text("EXPEDICIÓN ACTUAL", x + 48f * s, y + ph - 70f * s, 8.5f * s, kit.alpha(cyan, 220), kit.monoBold, Paint.Align.LEFT, 1.2f * s)
        kit.text("Sistema ${g.universe.currentSystem().name} · ${g.universe.currentPlanet().displayName} · ${g.universe.discoveredCount} descubrimientos · ${g.world.totalMined} recursos extraídos", x + 48f * s, y + ph - 51f * s, 9f * s, cream, kit.mono, Paint.Align.LEFT)
        kit.text("Los datos se sincronizan con el Nexo al despegar.", x + pw - 48f * s, y + ph - 52f * s, 8f * s, kit.alpha(muted, 160), kit.mono, Paint.Align.RIGHT)
        drawHelmetCorners(canvas, 0.5f)
    }

    private fun drawCraft(canvas: Canvas) {
        val w = kit.w
        val h = kit.h
        val s = kit.scale
        kit.fill.color = kit.alpha(dark, 190)
        canvas.drawRect(0f, 0f, w, h, kit.fill)
        val x = w * 0.06f
        val y = h * 0.07f
        val pw = w * 0.88f
        val ph = h * 0.85f
        kit.glowPanel(x, y, pw, ph, orange)
        kit.text("REFINADOR // FABRICACIÓN", x + 30f * s, y + 38f * s, 25f * s, cream, kit.sansBold, Paint.Align.LEFT, 3f * s)
        kit.text("PLANOS BÁSICOS · SINERGIA DEL EXOTRAJE · TECNOLOGÍA PROCEDURAL", x + 30f * s, y + 58f * s, 9f * s, kit.alpha(orange, 210), kit.mono, Paint.Align.LEFT, 1.3f * s)
        kit.button("close", x + pw - 120f * s, y + 20f * s, 92f * s, 34f * s, "VOLVER", ButtonStyle.GHOST, null, "×", cream)

        val listX = x + 30f * s
        val listY = y + 94f * s
        val rowH = (ph - 122f * s) / g.recipes.size
        for ((i, recipe) in g.recipes.withIndex()) {
            val ry = listY + i * rowH
            val canCraft = recipe.costs.all { (r, amount) -> g.player.amount(r) >= amount }
            kit.panel(listX, ry, pw * 0.63f, rowH - 7f * s, kit.alpha(if (canCraft) cyan else muted, 80), 0x99070F16.toInt(), 8f * s)
            kit.circle(listX + 26f * s, ry + (rowH - 7f * s) / 2f, 15f * s, kit.alpha(if (canCraft) cyan else muted, 30))
            kit.text(if (canCraft) "⌬" else "×", listX + 26f * s, ry + (rowH - 7f * s) / 2f + 5f * s, 13f * s, if (canCraft) cyan else muted, kit.sansBold, Paint.Align.CENTER)
            kit.text(recipe.name.uppercase(), listX + 50f * s, ry + 21f * s, 11f * s, cream, kit.sansBold, Paint.Align.LEFT, 0.9f * s)
            kit.text(recipe.description, listX + 50f * s, ry + 36f * s, 8.5f * s, kit.alpha(muted, 210), kit.mono, Paint.Align.LEFT)
            var cx = listX + 50f * s
            for ((r, amount) in recipe.costs) {
                val enough = g.player.amount(r) >= amount
                kit.chip(cx, ry + 44f * s, 84f * s, 17f * s, "${r.symbol} $amount", if (enough) r.color else danger, enough)
                cx += 90f * s
            }
            kit.text(recipe.output, listX + pw * 0.63f - 142f * s, ry + 25f * s, 8f * s, kit.alpha(cyan, 220), kit.mono, Paint.Align.RIGHT, 0.7f * s)
            kit.button("craft:${recipe.id}", listX + pw * 0.63f - 128f * s, ry + 10f * s, 104f * s, 30f * s, "FABRICAR", ButtonStyle.ACTION, null, "⌬", if (canCraft) cyan else muted, enabled = canCraft)
        }

        val sideX = x + pw * 0.70f
        kit.panel(sideX, listY, pw * 0.26f, ph - 122f * s, kit.alpha(orange, 100), 0x99070F16.toInt(), 10f * s)
        kit.text("REFINADOR PORTÁTIL", sideX + 18f * s, listY + 28f * s, 9f * s, kit.alpha(orange, 220), kit.monoBold, Paint.Align.LEFT, 1.3f * s)
        drawRefineryOrb(canvas, sideX + (pw * 0.26f) / 2f, listY + 106f * s, 45f * s)
        kit.text("Los materiales extraídos se procesan\naquí para obtener componentes de\nmayor pureza y valor comercial.", sideX + 18f * s, listY + 178f * s, 9f * s, kit.alpha(cream, 185), kit.mono, Paint.Align.LEFT)
        kit.line(sideX + 18f * s, listY + 214f * s, sideX + pw * 0.26f - 18f * s, listY + 214f * s, kit.alpha(orange, 90), 1f)
        kit.text("RECETA DESTACADA", sideX + 18f * s, listY + 236f * s, 8.5f * s, muted, kit.mono, Paint.Align.LEFT, 1.2f * s)
        kit.text("Célula de deformación", sideX + 18f * s, listY + 258f * s, 12f * s, cream, kit.sansBold, Paint.Align.LEFT, 0.5f * s)
        kit.text("4 Na + 4 H₂ + 2 Cu", sideX + 18f * s, listY + 276f * s, 9f * s, cyan, kit.mono, Paint.Align.LEFT)
        kit.text("Cada salto consume una célula.\nMejora el hiperimpulsor para\nacceder a estrellas rojas, verdes\ny azules.", sideX + 18f * s, listY + 300f * s, 8.5f * s, kit.alpha(muted, 210), kit.mono, Paint.Align.LEFT)
        kit.text("PRODUCCIÓN AUTOMÁTICA", sideX + 18f * s, listY + ph - 155f * s, 8f * s, kit.alpha(cyan, 170), kit.mono, Paint.Align.LEFT, 1.2f * s)
        kit.bar(sideX + 18f * s, listY + ph - 137f * s, pw * 0.26f - 36f * s, 7f * s, 0.64f, 1f, cyan, "NANITOS", "64%", "")
        drawHelmetCorners(canvas, 0.5f)
    }

    private fun drawHex(canvas: Canvas, cx: Float, cy: Float, radius: Float, color: Int, filled: Boolean) {
        val path = Path()
        for (i in 0 until 6) {
            val a = -PI.toFloat() / 2f + i * PI.toFloat() / 3f
            val px = cx + cos(a) * radius
            val py = cy + sin(a) * radius
            if (i == 0) path.moveTo(px, py) else path.lineTo(px, py)
        }
        path.close()
        kit.fill.style = Paint.Style.FILL
        kit.fill.color = kit.alpha(color, if (filled) 48 else 18)
        canvas.drawPath(path, kit.fill)
        kit.stroke.style = Paint.Style.STROKE
        kit.stroke.strokeWidth = 1f * kit.scale
        kit.stroke.color = kit.alpha(color, if (filled) 190 else 80)
        canvas.drawPath(path, kit.stroke)
    }

    private fun drawRefineryOrb(canvas: Canvas, cx: Float, cy: Float, r: Float) {
        val s = kit.scale
        kit.radial(cx, cy, r * 1.6f, kit.alpha(orange, 45), kit.alpha(orange, 0))
        kit.circle(cx, cy, r, 0xCC0B1720.toInt())
        kit.circle(cx, cy, r, kit.alpha(orange, 150), Paint.Style.STROKE)
        kit.circle(cx, cy, r * 0.62f, kit.alpha(cyan, 100), Paint.Style.STROKE)
        for (i in 0 until 5) {
            val a = kit.time * 0.7f + i * PI.toFloat() * 2f / 5f
            kit.circle(cx + cos(a) * r * 0.82f, cy + sin(a) * r * 0.82f, 3f * s, kit.alpha(orange, 210))
        }
        kit.circle(cx, cy, r * 0.2f, kit.alpha(cream, 200))
        kit.text("REFINAR", cx, cy + r + 18f * s, 8f * s, kit.alpha(orange, 180), kit.mono, Paint.Align.CENTER, 1.2f * s)
    }

    private fun drawCodexBackdrop(canvas: Canvas) {
        drawNebulaBackground(canvas, animated = false)
        kit.fill.color = kit.alpha(dark, 160)
        canvas.drawRect(0f, 0f, kit.w, kit.h, kit.fill)
    }

    private fun drawCodex(canvas: Canvas) {
        val w = kit.w
        val h = kit.h
        val s = kit.scale
        val x = w * 0.06f
        val y = h * 0.07f
        val pw = w * 0.88f
        val ph = h * 0.85f
        kit.glowPanel(x, y, pw, ph, cream)
        kit.text("CÓDICE DEL ATLAS", x + 30f * s, y + 38f * s, 26f * s, cream, kit.sansBold, Paint.Align.LEFT, 3.5f * s)
        kit.text("ARCHIVO DESCENTRALIZADO · LENGUA KORVAX · SEMILLA ${java.lang.Long.toHexString(g.galaxySeed).uppercase()}", x + 30f * s, y + 59f * s, 9f * s, kit.alpha(cyan, 210), kit.mono, Paint.Align.LEFT, 1.1f * s)
        kit.button("close", x + pw - 120f * s, y + 20f * s, 92f * s, 34f * s, "VOLVER", ButtonStyle.GHOST, null, "×", cream)

        val colW = (pw - 90f * s) / 3f
        val top = y + 93f * s
        val bottom = y + ph - 35f * s
        for (i in 0 until 2) {
            val lx = x + 30f * s + colW * (i + 1) + 15f * s
            kit.line(lx, top, lx, bottom, kit.alpha(cyan, 50), 1f)
        }

        val c1 = x + 30f * s
        kit.text("I. EL ATLAS FRACTURADO", c1, top + 18f * s, 9.5f * s, kit.alpha(orange, 220), kit.monoBold, Paint.Align.LEFT, 1.7f * s)
        kit.text("Los atlas no son mapas.", c1, top + 47f * s, 12f * s, cream, kit.serif, Paint.Align.LEFT)
        kit.text(
            "Son entidades. Fragmentos de una voluntad\n" +
                "antigua que aprendió a existir dentro de las\n" +
                "matemáticas. Cada sistema estelar es una\n" +
                "ecuación; cada criatura, una variación.\n\n" +
                "Los centinelas no protegen la vida. Protegen\n" +
                "la integridad de la simulación. Cuando el\n" +
                "exotraje extrae demasiado, el universo responde\n" +
                "con violencia geométrica.\n\n" +
                "El Nexo flota fuera de la secuencia. Allí, los\n" +
                "viajeros comparten nombres, misiones y la\n" +
                "certeza de que nadie ha visto el final.\n\n" +
                "Tu semilla es única. Tu ruta también.",
            c1, top + 72f * s, 10f * s, 0xFFD4DEDC.toInt(), kit.mono, Paint.Align.LEFT
        )
        kit.text("-- Archivo Korvax, fragmento 0x7F", c1, bottom - 28f * s, 8.5f * s, kit.alpha(muted, 190), kit.mono, Paint.Align.LEFT)
        kit.text("SIGUE LA SEÑAL DEL ATLAS", c1, bottom - 10f * s, 8f * s, kit.alpha(cyan, 180), kit.monoBold, Paint.Align.LEFT, 1.3f * s)

        val c2 = c1 + colW + 15f * s
        val sys = g.universe.currentSystem()
        val planet = g.universe.currentPlanet()
        kit.text("II. CATÁLOGO LOCAL", c2, top + 18f * s, 9.5f * s, kit.alpha(cyan, 220), kit.monoBold, Paint.Align.LEFT, 1.7f * s)
        kit.text(sys.name.uppercase(), c2, top + 47f * s, 16f * s, cream, kit.sansBold, Paint.Align.LEFT, 1.3f * s)
        kit.text("${sys.starClass.label} · ${sys.economy.label} · ${sys.wealthLabel}", c2, top + 65f * s, 8.5f * s, sys.starClass.color, kit.mono, Paint.Align.LEFT)
        kit.text(planet.displayName.uppercase(), c2, top + 92f * s, 12f * s, planet.biome.accent, kit.sansBold, Paint.Align.LEFT, 0.8f * s)
        kit.text("${planet.biome.label} · ${planet.weather}", c2, top + 107f * s, 8.5f * s, muted, kit.mono, Paint.Align.LEFT)
        kit.text(planet.biome.description, c2, top + 126f * s, 8.7f * s, kit.alpha(cream, 190), kit.mono, Paint.Align.LEFT)
        kit.text("RECURSOS DETECTADOS", c2, top + 158f * s, 8f * s, kit.alpha(cyan, 190), kit.monoBold, Paint.Align.LEFT, 1.3f * s)
        for ((i, r) in planet.resources.withIndex()) {
            kit.chip(c2 + i * 95f * s, top + 168f * s, 88f * s, 19f * s, "${r.symbol} ${r.label.take(7)}", r.color, true)
        }
        kit.text("FAUNA CATALOGADA", c2, top + 211f * s, 8f * s, kit.alpha(cyan, 190), kit.monoBold, Paint.Align.LEFT, 1.3f * s)
        for ((i, name) in planet.faunaNames.take(4).withIndex()) {
            val fy = top + 225f * s + i * 24f * s
            kit.circle(c2 + 7f * s, fy - 3f * s, 3f * s, planet.biome.accent)
            kit.text(name, c2 + 18f * s, fy, 9f * s, cream, kit.mono, Paint.Align.LEFT)
            kit.text("${if (i < g.world.faunaScanned) "CATALOGADA" else "SIN DATOS"}", c2 + colW - 52f * s, fy, 7.5f * s, if (i < g.world.faunaScanned) cyan else muted, kit.mono, Paint.Align.RIGHT, 0.7f * s)
        }
        kit.text("FLORA / MINERAL", c2, top + 331f * s, 8f * s, kit.alpha(cyan, 190), kit.monoBold, Paint.Align.LEFT, 1.3f * s)
        kit.text("${planet.flora} especies vegetales · ${planet.fauna} especies animales", c2, top + 348f * s, 8.5f * s, kit.alpha(cream, 185), kit.mono, Paint.Align.LEFT)
        kit.text("RADIO ${planet.radiusKm} km · CENTINELAS NIVEL ${planet.sentinelLevel}", c2, top + 364f * s, 8.2f * s, kit.alpha(muted, 190), kit.mono, Paint.Align.LEFT)

        val c3 = c2 + colW + 15f * s
        kit.text("III. REGISTRO DE VIAJE", c3, top + 18f * s, 9.5f * s, kit.alpha(orange, 220), kit.monoBold, Paint.Align.LEFT, 1.7f * s)
        val stats = listOf(
            "SISTEMA ACTUAL" to sys.name,
            "PLANETA" to planet.displayName,
            "DESCUBRIMIENTOS" to g.universe.discoveredCount.toString(),
            "ESCANEO LOCAL" to "${(g.world.discoveredRatio() * 100).toInt()}%",
            "RECURSOS EXTRAÍDOS" to g.world.totalMined.toString(),
            "UNIDADES" to formatNumber(g.player.units),
            "NANITOS" to formatNumber(g.player.nanites),
            "SALTOS DISPONIBLES" to g.player.warpCells.toString()
        )
        for ((i, pair) in stats.withIndex()) {
            val sy = top + 43f * s + i * 31f * s
            kit.text(pair.first, c3, sy, 7.8f * s, muted, kit.mono, Paint.Align.LEFT, 1f * s)
            kit.text(pair.second, c3, sy + 13f * s, 10f * s, cream, kit.monoBold, Paint.Align.LEFT)
        }
        kit.panel(c3, top + 310f * s, colW - 12f * s, 93f * s, kit.alpha(orange, 70), 0x88081018.toInt(), 8f * s)
        kit.text("PALABRAS APRENDIDAS", c3 + 14f * s, top + 332f * s, 8f * s, kit.alpha(orange, 200), kit.monoBold, Paint.Align.LEFT, 1.2f * s)
        kit.text("KORVAX · 014", c3 + 14f * s, top + 352f * s, 12f * s, cream, kit.monoBold, Paint.Align.LEFT)
        kit.text("gek · 006    vy'keen · 009", c3 + 14f * s, top + 370f * s, 8.5f * s, kit.alpha(cyan, 200), kit.mono, Paint.Align.LEFT)
        kit.text("Aprende idiomas en monolitos y ruinas.", c3 + 14f * s, top + 389f * s, 7.7f * s, kit.alpha(muted, 185), kit.mono, Paint.Align.LEFT)
        kit.text("El centro de la galaxia no es un lugar.", c3, bottom - 28f * s, 9f * s, kit.alpha(cream, 180), kit.serif, Paint.Align.LEFT)
        kit.text("Es una pregunta.", c3, bottom - 12f * s, 11f * s, kit.alpha(orange, 210), kit.serif, Paint.Align.LEFT)
        drawHelmetCorners(canvas, 0.5f)
    }

    private fun drawPause(canvas: Canvas) {
        val w = kit.w
        val h = kit.h
        val s = kit.scale
        kit.fill.color = kit.alpha(dark, 190)
        canvas.drawRect(0f, 0f, w, h, kit.fill)
        val pw = min(w * 0.66f, 980f * s)
        val ph = min(h * 0.76f, 620f * s)
        val x = w / 2f - pw / 2f
        val y = h / 2f - ph / 2f
        kit.glowPanel(x, y, pw, ph, cyan)
        kit.text("PAUSA DE EXPEDICIÓN", x + 38f * s, y + 48f * s, 28f * s, cream, kit.sansBold, Paint.Align.LEFT, 4f * s)
        kit.text("EXOTRAJE EN SUSPENSO · ENLACE CON EL NEXO ESTABLE", x + 40f * s, y + 70f * s, 9f * s, kit.alpha(cyan, 210), kit.mono, Paint.Align.LEFT, 1.2f * s)
        kit.line(x + 40f * s, y + 88f * s, x + pw - 40f * s, y + 88f * s, kit.alpha(cyan, 80), 1f)

        val col1 = x + 40f * s
        val col2 = x + pw * 0.54f
        kit.text("CONTROLES", col1, y + 120f * s, 9f * s, kit.alpha(orange, 220), kit.monoBold, Paint.Align.LEFT, 1.5f * s)
        val controls = listOf(
            "Joystick inferior izquierdo" to "Moverse por la superficie",
            "Arrastrar lado derecho" to "Mirar y apuntar",
            "ESCANEAR" to "Revelar flora, fauna y recursos",
            "MINAR (mantener)" to "Extraer elementos de las vetas",
            "JETPACK (mantener)" to "Elevarse y salvar desniveles",
            "DISPARAR (mantener)" to "Responder a los centinelas",
            "INVENTARIO / FABRICAR" to "Gestionar recursos y tecnología"
        )
        for ((i, c) in controls.withIndex()) {
            val cy = y + 144f * s + i * 33f * s
            kit.circle(col1 + 6f * s, cy - 4f * s, 2.4f * s, kit.alpha(cyan, 170))
            kit.text(c.first, col1 + 18f * s, cy, 10f * s, cream, kit.sansBold, Paint.Align.LEFT, 0.4f * s)
            kit.text(c.second, col1 + 18f * s, cy + 12f * s, 8f * s, kit.alpha(muted, 200), kit.mono, Paint.Align.LEFT)
        }

        kit.text("SINCRONIZACIÓN", col2, y + 120f * s, 9f * s, kit.alpha(orange, 220), kit.monoBold, Paint.Align.LEFT, 1.5f * s)
        kit.panel(col2, y + 136f * s, pw * 0.40f, 118f * s, kit.alpha(cyan, 80), 0x88081018.toInt(), 9f * s)
        kit.keyValue(col2 + 18f * s, y + 162f * s, "SISTEMA", g.universe.currentSystem().name, cream, 82f)
        kit.keyValue(col2 + 18f * s, y + 184f * s, "PLANETA", g.universe.currentPlanet().displayName, cream, 82f)
        kit.keyValue(col2 + 18f * s, y + 206f * s, "SEMILLA", java.lang.Long.toHexString(g.universe.currentSystem().seed).take(12).uppercase(), cyan, 82f)
        kit.keyValue(col2 + 18f * s, y + 228f * s, "PROGRESO", "${(g.world.discoveredRatio() * 100).toInt()}% del ecosistema", cyan, 82f)
        kit.text("La partida se guarda automáticamente al despegar, comerciar y entrar en el Nexo.", col2, y + 276f * s, 8f * s, kit.alpha(muted, 200), kit.mono, Paint.Align.LEFT)

        val bY = y + ph - 86f * s
        kit.button("resume", col1, bY, 190f * s, 48f * s, "REANUDAR", ButtonStyle.PRIMARY, null, "▶", cyan)
        kit.button("save", col1 + 202f * s, bY, 140f * s, 48f * s, "GUARDAR", ButtonStyle.ACTION, null, "▣", cream)
        kit.button("title", col1 + 354f * s, bY, 170f * s, 48f * s, "SALIR AL MENÚ", ButtonStyle.DANGER, null, "×", danger)
        kit.text("FRACTURED SKIES · BUILD 1.0.0 · ANDROID KOTLIN", x + pw - 40f * s, y + ph - 20f * s, 8f * s, kit.alpha(muted, 170), kit.mono, Paint.Align.RIGHT, 1.2f * s)
    }

    private fun drawWarp(canvas: Canvas) {
        val w = kit.w
        val h = kit.h
        val s = kit.scale
        val t = g.warpT.coerceIn(0f, 1f)
        kit.fill.color = 0xFF02040A.toInt()
        canvas.drawRect(0f, 0f, w, h, kit.fill)
        val cx = w / 2f
        val cy = h / 2f
        kit.radial(cx, cy, h * 0.8f, kit.alpha(0xFF4D7CFF.toInt(), (44 + 55 * sin(t * PI.toFloat())).toInt()), kit.alpha(dark, 0))
        for (i in 0 until 220) {
            val seed = i * 104729
            val a = (seed % 6283) / 1000f + kit.time * 0.08f
            val base = ((seed * 37) % 1000) / 1000f
            val rr = (base + t * 1.6f) % 1f
            val len = (0.02f + base * 0.16f) * h * (0.2f + t)
            val x1 = cx + cos(a) * rr * h * 0.9f
            val y1 = cy + sin(a) * rr * h * 0.6f
            val x2 = cx + cos(a) * (rr * h * 0.9f + len)
            val y2 = cy + sin(a) * (rr * h * 0.6f + len * 0.6f)
            val col = if (i % 9 == 0) kit.alpha(cyan, (80 + 120 * t).toInt()) else kit.alpha(cream, (40 + 100 * t).toInt())
            kit.line(x1, y1, x2, y2, col, 0.8f + base * 1.4f)
        }
        kit.radial(cx, cy, h * 0.18f, kit.alpha(0xFFFFFFFF.toInt(), (180 + 60 * t).toInt()), kit.alpha(0xFF6EC8FF.toInt(), 0))
        kit.text("SALTO INTERESTELAR", cx, h * 0.16f, 16f * s, cream, kit.sansBold, Paint.Align.CENTER, 6f * s)
        kit.text("TRAZANDO RUTA ENTRE SEMILLAS", cx, h * 0.195f, 8.5f * s, kit.alpha(cyan, 210), kit.mono, Paint.Align.CENTER, 1.8f * s)
        val from = g.universe.systemAt(g.warpFrom)
        val to = g.universe.systemAt(g.warpTo)
        kit.text("${from.name.uppercase()}  →  ${to.name.uppercase()}", cx, h * 0.79f, 14f * s, cream, kit.monoBold, Paint.Align.CENTER, 2.2f * s)
        kit.text("${to.starClass.label} · ${to.economy.label.uppercase()} · HIPERIMPULSOR CLASE ${'A' + g.player.hyperdriveLevel}", cx, h * 0.82f, 8.5f * s, kit.alpha(muted, 220), kit.mono, Paint.Align.CENTER, 1.2f * s)
        kit.bar(cx - w * 0.18f, h * 0.87f, w * 0.36f, 7f * s, t, 1f, cyan, "PROGRESO DE SALTO", "${(t * 100).toInt()}%", "")
        kit.text("NO CORTES LA SEÑAL", cx, h * 0.91f, 8f * s, kit.alpha(cyan, 130 + 80 * sin(kit.time * 4f).toInt()), kit.mono, Paint.Align.CENTER, 2f * s)
        drawHelmetCorners(canvas, 0.4f)
    }

    private fun normalize3(x: Float, y: Float, z: Float): FloatArray {
        val len = sqrt(x * x + y * y + z * z)
        if (len <= 0.0001f) return floatArrayOf(0f, 1f, 0f)
        return floatArrayOf(x / len, y / len, z / len)
    }
}
