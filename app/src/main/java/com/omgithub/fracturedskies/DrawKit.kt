package com.omgithub.fracturedskies

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import kotlin.math.min

class DrawKit(private val g: Game) {
    val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }
    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.LEFT
    }

    val sans = Typeface.create("sans-serif-condensed", Typeface.NORMAL)
    val sansBold = Typeface.create("sans-serif-condensed", Typeface.BOLD)
    val sansBlack = Typeface.create("sans-serif", Typeface.BOLD)
    val mono = Typeface.create("monospace", Typeface.NORMAL)
    val monoBold = Typeface.create("monospace", Typeface.BOLD)
    val serif = Typeface.create("serif", Typeface.NORMAL)

    val buttons = ArrayList<UiButton>()
    var canvas: Canvas? = null
    var w = 1f
    var h = 1f
    var scale = 1f
    var time = 0f

    fun begin(canvas: Canvas) {
        this.canvas = canvas
        w = g.width.toFloat()
        h = g.height.toFloat()
        scale = min(w / 1920f, h / 1080f)
        time = g.time
        buttons.clear()
    }

    fun finish() {
        g.uiButtons = buttons.toList()
        canvas = null
    }

    fun mix(a: Int, b: Int, t: Float): Int {
        val f = t.coerceIn(0f, 1f)
        return Color.argb(
            (Color.alpha(a) + (Color.alpha(b) - Color.alpha(a)) * f).toInt(),
            (Color.red(a) + (Color.red(b) - Color.red(a)) * f).toInt(),
            (Color.green(a) + (Color.green(b) - Color.green(a)) * f).toInt(),
            (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * f).toInt()
        )
    }

    fun alpha(color: Int, a: Int): Int = Color.argb(a.coerceIn(0, 255), Color.red(color), Color.green(color), Color.blue(color))

    fun dim(color: Int, factor: Float): Int = Color.argb(
        Color.alpha(color),
        (Color.red(color) * factor).toInt().coerceIn(0, 255),
        (Color.green(color) * factor).toInt().coerceIn(0, 255),
        (Color.blue(color) * factor).toInt().coerceIn(0, 255)
    )

    fun cutPath(x: Float, y: Float, width: Float, height: Float, cut: Float): Path {
        val p = Path()
        val c = min(cut, min(width, height) * 0.32f)
        p.moveTo(x + c, y)
        p.lineTo(x + width - c, y)
        p.lineTo(x + width, y + c)
        p.lineTo(x + width, y + height - c)
        p.lineTo(x + width - c, y + height)
        p.lineTo(x + c, y + height)
        p.lineTo(x, y + height - c)
        p.lineTo(x, y + c)
        p.close()
        return p
    }

    fun panel(x: Float, y: Float, width: Float, height: Float, border: Int = 0x5537F2D4, fillColor: Int = 0xD4070F18.toInt(), cut: Float = 18f) {
        val c = canvas ?: return
        val path = cutPath(x, y, width, height, cut * scale)
        fill.style = Paint.Style.FILL
        fill.shader = null
        fill.color = fillColor
        c.drawPath(path, fill)
        stroke.style = Paint.Style.STROKE
        stroke.strokeWidth = 1.4f * scale
        stroke.color = border
        c.drawPath(path, stroke)
    }

    fun glowPanel(x: Float, y: Float, width: Float, height: Float, accent: Int = 0xFF37F2D4.toInt()) {
        val c = canvas ?: return
        val path = cutPath(x, y, width, height, 16f * scale)
        fill.style = Paint.Style.FILL
        fill.shader = LinearGradient(
            x, y, x + width, y + height,
            alpha(accent, 50), alpha(0xFF050A10.toInt(), 232),
            Shader.TileMode.CLAMP
        )
        c.drawPath(path, fill)
        fill.shader = null
        stroke.style = Paint.Style.STROKE
        stroke.strokeWidth = 1.5f * scale
        stroke.color = alpha(accent, 170)
        c.drawPath(path, stroke)
    }

    fun text(
        value: String,
        x: Float,
        y: Float,
        size: Float,
        color: Int,
        typeface: Typeface = sans,
        align: Paint.Align = Paint.Align.LEFT,
        letterSpacing: Float = 0f
    ) {
        val c = canvas ?: return
        textPaint.typeface = typeface
        textPaint.textSize = size
        textPaint.color = color
        textPaint.textAlign = align
        textPaint.shader = null
        if (letterSpacing <= 0.001f) {
            c.drawText(value, x, y, textPaint)
        } else {
            var cx = x
            val widths = value.map { ch ->
                val adv = textPaint.measureText(ch.toString())
                Pair(ch, adv)
            }
            val total = widths.sumOf { it.second.toDouble() }.toFloat() + (widths.size - 1).coerceAtLeast(0) * letterSpacing
            if (align == Paint.Align.CENTER) cx -= total / 2f
            else if (align == Paint.Align.RIGHT) cx -= total
            widths.forEach { (ch, adv) ->
                c.drawText(ch.toString(), cx, y, textPaint)
                cx += adv + letterSpacing
            }
        }
    }

    fun textGlow(
        value: String,
        x: Float,
        y: Float,
        size: Float,
        color: Int,
        typeface: Typeface = sansBlack,
        align: Paint.Align = Paint.Align.LEFT,
        glow: Int = color
    ) {
        val c = canvas ?: return
        textPaint.typeface = typeface
        textPaint.textSize = size
        textPaint.textAlign = align
        textPaint.color = alpha(glow, 60)
        textPaint.shader = null
        c.drawText(value, x + size * 0.04f, y + size * 0.04f, textPaint)
        textPaint.color = color
        c.drawText(value, x, y, textPaint)
    }

    fun line(x1: Float, y1: Float, x2: Float, y2: Float, color: Int, width: Float = 1f) {
        val c = canvas ?: return
        stroke.shader = null
        stroke.color = color
        stroke.strokeWidth = width * scale
        c.drawLine(x1, y1, x2, y2, stroke)
    }

    fun rect(x: Float, y: Float, width: Float, height: Float, color: Int) {
        fill.shader = null
        fill.style = Paint.Style.FILL
        fill.color = color
        canvas?.drawRect(x, y, x + width, y + height, fill)
    }

    fun roundRect(x: Float, y: Float, width: Float, height: Float, radius: Float, color: Int) {
        fill.shader = null
        fill.style = Paint.Style.FILL
        fill.color = color
        canvas?.drawRoundRect(RectF(x, y, x + width, y + height), radius, radius, fill)
    }

    fun circle(cx: Float, cy: Float, radius: Float, color: Int, style: Paint.Style = Paint.Style.FILL) {
        val c = canvas ?: return
        if (style == Paint.Style.FILL) {
            fill.shader = null
            fill.style = Paint.Style.FILL
            fill.color = color
            c.drawCircle(cx, cy, radius, fill)
        } else {
            stroke.shader = null
            stroke.style = Paint.Style.STROKE
            stroke.color = color
            stroke.strokeWidth = 1.2f * scale
            c.drawCircle(cx, cy, radius, stroke)
        }
    }

    fun radial(cx: Float, cy: Float, radius: Float, inner: Int, outer: Int) {
        val c = canvas ?: return
        fill.style = Paint.Style.FILL
        fill.shader = RadialGradient(cx, cy, radius, inner, outer, Shader.TileMode.CLAMP)
        c.drawCircle(cx, cy, radius, fill)
        fill.shader = null
    }

    fun bar(
        x: Float,
        y: Float,
        width: Float,
        height: Float,
        value: Float,
        maxValue: Float,
        color: Int,
        label: String,
        valueText: String,
        icon: String = ""
    ) {
        val c = canvas ?: return
        val ratio = (value / maxValue).coerceIn(0f, 1f)
        text(label, x, y - 5f * scale, 10.5f * scale, 0xFF9DB3BA.toInt(), mono, Paint.Align.LEFT, 1.1f * scale)
        text(valueText, x + width, y - 5f * scale, 10.5f * scale, color, mono, Paint.Align.RIGHT)
        fill.shader = null
        fill.style = Paint.Style.FILL
        fill.color = 0x66040A10
        c.drawRect(x, y, x + width, y + height, fill)
        fill.color = alpha(color, 42)
        c.drawRect(x, y, x + width * ratio, y + height, fill)
        fill.color = color
        c.drawRect(x, y, x + width * ratio, y + height * 0.48f, fill)
        stroke.style = Paint.Style.STROKE
        stroke.strokeWidth = 1f * scale
        stroke.color = alpha(color, 110)
        c.drawRect(x, y, x + width, y + height, stroke)
        if (icon.isNotEmpty()) {
            text(icon, x - 19f * scale, y + height * 0.92f, 13f * scale, alpha(color, 210), sansBold, Paint.Align.CENTER)
        }
    }

    fun button(
        action: String,
        x: Float,
        y: Float,
        width: Float,
        height: Float,
        label: String,
        style: ButtonStyle = ButtonStyle.GHOST,
        sublabel: String? = null,
        icon: String? = null,
        accent: Int = 0xFF37F2D4.toInt(),
        enabled: Boolean = true,
        hold: Boolean = false
    ) {
        val c = canvas ?: return
        buttons.add(UiButton(action, RectF(x, y, x + width, y + height), label, style, sublabel, icon, accent, hold, enabled))
        val path = cutPath(x, y, width, height, height * 0.19f)
        val primary = style == ButtonStyle.PRIMARY
        val danger = style == ButtonStyle.DANGER
        val a = if (!enabled) 0xFF59636B.toInt() else if (danger) 0xFFFF5E5E.toInt() else accent
        fill.shader = null
        fill.style = Paint.Style.FILL
        when (style) {
            ButtonStyle.PRIMARY -> fill.color = if (enabled) a else 0xFF29343D.toInt()
            ButtonStyle.ACTION -> fill.color = if (enabled) 0xCC0A1720.toInt() else 0x99101820.toInt()
            ButtonStyle.DANGER -> fill.color = 0xCC240D10.toInt()
            ButtonStyle.SMALL, ButtonStyle.TAB -> fill.color = 0xAA0B1620.toInt()
            ButtonStyle.GHOST -> fill.color = 0x55070E15
        }
        c.drawPath(path, fill)
        if (style == ButtonStyle.ACTION || style == ButtonStyle.GHOST || style == ButtonStyle.SMALL || style == ButtonStyle.DANGER) {
            stroke.style = Paint.Style.STROKE
            stroke.strokeWidth = (if (style == ButtonStyle.ACTION) 1.7f else 1.1f) * scale
            stroke.color = alpha(a, if (enabled) 190 else 80)
            c.drawPath(path, stroke)
        }
        if (style == ButtonStyle.PRIMARY) {
            fill.color = alpha(a, 55)
            c.drawRect(x + width * 0.02f, y + height * 0.1f, x + width * 0.05f, y + height * 0.9f, fill)
        }
        val textColor = when {
            !enabled -> 0xFF758087.toInt()
            primary -> 0xFF041014.toInt()
            danger -> 0xFFFFC6C6.toInt()
            else -> 0xFFF2F6F3.toInt()
        }
        val textSize = if (style == ButtonStyle.SMALL) 10.5f * scale else min(height * 0.32f, 21f * scale)
        var tx = x + width / 2f
        if (icon != null) {
            tx += 7f * scale
            text(icon, x + width * 0.16f, y + height * 0.62f, textSize * 1.25f, if (!enabled) 0xFF758087.toInt() else a, sansBold, Paint.Align.CENTER)
        }
        text(label, tx, y + height * (if (sublabel == null) 0.62f else 0.48f), textSize, textColor, sansBold, Paint.Align.CENTER, 0.7f * scale)
        if (sublabel != null) {
            text(sublabel, tx, y + height * 0.77f, 9.5f * scale, if (primary) 0xFF2C3C3D.toInt() else alpha(textColor, 150), mono, Paint.Align.CENTER)
        }
    }

    fun chip(x: Float, y: Float, width: Float, height: Float, label: String, color: Int, filled: Boolean = false) {
        val path = cutPath(x, y, width, height, height * 0.3f)
        fill.style = Paint.Style.FILL
        fill.color = if (filled) alpha(color, 48) else 0x77060D13
        canvas?.drawPath(path, fill)
        stroke.style = Paint.Style.STROKE
        stroke.strokeWidth = 1f * scale
        stroke.color = alpha(color, 150)
        canvas?.drawPath(path, stroke)
        text(label, x + width / 2f, y + height * 0.68f, 9.8f * scale, color, monoBold, Paint.Align.CENTER, 0.6f * scale)
    }

    fun keyValue(x: Float, y: Float, key: String, value: String, color: Int = 0xFFF5E9C8.toInt(), keyWidth: Float = 130f) {
        text(key, x, y, 10.5f * scale, 0xFF83969D.toInt(), mono, Paint.Align.LEFT, 1f * scale)
        text(value, x + keyWidth * scale, y, 11f * scale, color, monoBold, Paint.Align.LEFT)
    }

    fun dashedLine(x1: Float, y1: Float, x2: Float, y2: Float, color: Int, width: Float = 1f, dash: Float = 6f) {
        val c = canvas ?: return
        stroke.style = Paint.Style.STROKE
        stroke.color = color
        stroke.strokeWidth = width * scale
        stroke.pathEffect = android.graphics.DashPathEffect(floatArrayOf(dash * scale, dash * scale), 0f)
        c.drawLine(x1, y1, x2, y2, stroke)
        stroke.pathEffect = null
    }
}
