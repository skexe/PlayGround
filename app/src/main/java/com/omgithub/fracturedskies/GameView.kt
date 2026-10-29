package com.omgithub.fracturedskies

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView
import kotlin.math.min

@SuppressLint("ViewConstructor")
class GameView(context: Context) : SurfaceView(context), SurfaceHolder.Callback, Runnable {

    private val game = Game(context)
    private var thread: Thread? = null
    @Volatile private var running = false
    private var paused = false
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var lastFrame = 0L

    init {
        holder.addCallback(this)
        isFocusable = true
        keepScreenOn = true
    }

    override fun surfaceCreated(holder: SurfaceHolder) {
        startLoop()
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        game.resize(width, height)
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        stopLoop()
    }

    private fun startLoop() {
        if (running) return
        running = true
        lastFrame = System.nanoTime()
        thread = Thread(this, "FracturedSkies-Render").also { it.start() }
    }

    private fun stopLoop() {
        running = false
        thread?.join(1500)
        thread = null
    }

    fun resumeGame() {
        paused = false
        game.resume()
        if (holder.surface.isValid) startLoop()
    }

    fun pauseGame() {
        paused = true
        game.pause()
    }

    fun handleBack(): Boolean = game.back()

    override fun run() {
        while (running) {
            if (paused) {
                Thread.sleep(80)
                continue
            }
            val now = System.nanoTime()
            val dt = min(0.05f, (now - lastFrame) / 1_000_000_000f)
            lastFrame = now
            var canvas: Canvas? = null
            try {
                canvas = holder.lockCanvas()
                if (canvas != null) {
                    game.update(dt)
                    game.draw(canvas)
                }
            } catch (_: Throwable) {
                // A surface teardown can race the render thread. The next loop recovers.
            } finally {
                if (canvas != null) {
                    try {
                        holder.unlockCanvasAndPost(canvas)
                    } catch (_: Throwable) {
                    }
                }
            }
            val elapsed = (System.nanoTime() - now) / 1_000_000
            val sleep = 16 - elapsed
            if (sleep > 0) Thread.sleep(sleep)
        }
        paint.color = Color.BLACK
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        game.onTouch(event)
        return true
    }
}
