package com.omgithub.fracturedskies

import kotlin.math.max
import kotlin.math.min

class Player {
    var x = 0f
    var z = 0f
    var yaw = 0f
    var pitch = 0f

    var health = 100f
    var shield = 100f
    var hazard = 100f
    var oxygen = 100f
    var jetpack = 100f

    var units = 2450
    var nanites = 12
    var wanted = 0
    var warpCells = 1
    var launchFuel = 2
    var hyperdriveLevel = 0
    var miningLevel = 1
    var scannerLevel = 1
    var scannerCharges = 3

    val inventory: MutableMap<ResourceType, Int> = linkedMapOf(
        ResourceType.CARBON to 48,
        ResourceType.FERRITE to 24,
        ResourceType.SODIUM to 12,
        ResourceType.OXYGEN to 18,
        ResourceType.DIHYDROGEN to 8
    )

    fun amount(resource: ResourceType): Int = inventory[resource] ?: 0

    fun add(resource: ResourceType, quantity: Int) {
        if (quantity <= 0) return
        inventory[resource] = amount(resource) + quantity
    }

    fun take(resource: ResourceType, quantity: Int): Boolean {
        if (quantity <= 0) return true
        val have = amount(resource)
        if (have < quantity) return false
        inventory[resource] = have - quantity
        return true
    }

    fun damage(amount: Float) {
        var left = amount
        if (shield > 0f) {
            val absorbed = min(shield, left)
            shield -= absorbed
            left -= absorbed
        }
        if (left > 0f) health = max(0f, health - left)
    }

    fun rechargeLifeSupport(): Boolean {
        if (oxygen >= 99f) return false
        if (!take(ResourceType.OXYGEN, 2)) return false
        oxygen = min(100f, oxygen + 26f)
        return true
    }

    fun rechargeHazard(): Boolean {
        if (hazard >= 99f) return false
        if (!take(ResourceType.SODIUM, 2)) return false
        hazard = min(100f, hazard + 30f)
        return true
    }

    fun rechargeShield(): Boolean {
        if (shield >= 99f) return false
        if (!take(ResourceType.FERRITE, 3)) return false
        shield = min(100f, shield + 35f)
        return true
    }

    fun rechargeJetpack(): Boolean {
        if (jetpack >= 99f) return false
        if (!take(ResourceType.CARBON, 2)) return false
        jetpack = min(100f, jetpack + 40f)
        return true
    }

    fun totalResources(): Int = inventory.values.sum()

    fun resetAtSurface() {
        x = 0f
        z = 0f
        yaw = 0.32f
        pitch = -0.12f
        health = 100f
        shield = 100f
        hazard = 100f
        oxygen = 100f
        jetpack = 100f
    }

    fun respawn() {
        health = 100f
        shield = 60f
        hazard = 60f
        oxygen = 60f
        jetpack = 100f
        x = 0f
        z = 0f
        wanted = 0
    }
}
