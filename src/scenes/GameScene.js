import Phaser from 'phaser';

import SaveManager from '../SaveManager';
import LootManager from '../LootManager';

class Monster extends Phaser.GameObjects.Container {
    constructor(scene, x, y, data) {
        super(scene, x, y);
        this.scene = scene;
        this.data = data;
        this.hp = data.hp;
        this.maxHp = data.maxHp;
        this.isBoss = data.isBoss || false;

        // Sprite
        const spriteKey = this.isBoss && scene.level === 100 ? 'boss' : 'slime';
        this.sprite = scene.add.sprite(0, 0, spriteKey);
        if (this.isBoss && scene.level === 100) {
            this.sprite.setDisplaySize(128, 128); // 64x64 scaled up
        } else {
            this.sprite.setScale(2);
        }
        this.add(this.sprite);

        // ATK Label (Always visible)
        this.atkLabel = scene.add.text(0, -50, `[ATK: ${data.atk}]`, { fontSize: '14px', color: '#ff0' }).setOrigin(0.5);
        this.add(this.atkLabel);

        // HP Bar (Under feet)
        this.hpBg = scene.add.graphics();
        this.hpBg.fillStyle(0x000000);
        this.hpBg.fillRect(-30, 30, 60, 6);
        this.add(this.hpBg);

        this.hpBar = scene.add.graphics();
        this.updateHPBar();
        this.add(this.hpBar);

        // Distance-based HP Text
        this.hpText = scene.add.text(0, 50, `[HP: ${this.hp}/${this.maxHp}]`, { fontSize: '12px' }).setOrigin(0.5);
        this.hpText.setVisible(false);
        this.add(this.hpText);

        scene.add.existing(this);
    }

    update() {
        // Distance logic
        const dist = Phaser.Math.Distance.Between(this.x, this.y, this.scene.hero.x, this.scene.hero.y);
        this.hpText.setVisible(dist < 64);
    }

    updateHPBar() {
        this.hpBar.clear();
        this.hpBar.fillStyle(0x00ff00);
        const width = (this.hp / this.maxHp) * 58;
        this.hpBar.fillRect(-29, 31, width, 4);

        // Boss Phase Checks
        if (this.isBoss && this.scene.level === 100) {
            const ratio = this.hp / this.maxHp;
            if (ratio < 0.3) this.sprite.setTint(0xff0000); // Phase 3
            else if (ratio < 0.7) this.sprite.setTint(0xffaa00); // Phase 2
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
        this.updateHPBar();
        this.hpText.setText(`[HP: ${this.hp}/${this.maxHp}]`);

        // Tiny shake on hit
        this.scene.tweens.add({
            targets: this,
            x: this.x + 5,
            duration: 50,
            yoyo: true,
            repeat: 2
        });

        if (this.hp <= 0) {
            SaveManager.saveKill(this.data);
            this.scene.rollLoot(this.x, this.y);
            if (this.isBoss && this.scene.level === 100) {
                this.scene.dropArtifact();
            }
            return true; // Dead
        }
        return false;
    }
}

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.level = 1;
        this.gold = 0;
        this.ng = 0;
        this.baseStats = { spd: 40, atk: 20, hp: 120, maxHp: 120, lifesteal: 0.1, luck: 1.0 };
        this.heroStats = { ...this.baseStats };
        this.combo = 0;
        this.lastHitTime = 0;
        this.droppedItems = [];
        this.isDying = false;
    }

    create() {
        const { width, height } = this.scale;
        const gameHeight = height * 0.7;

        SaveManager.setCheckpoint(this.level, this.gold, [], {});
        this.refreshStats();

        this.cameras.main.setViewport(0, 0, width, gameHeight);
        this.cameras.main.setBackgroundColor('#1a1a1a');

        this.monsterData = this.cache.json.get('monsters');
        this.createMap();

        this.hero = this.add.sprite(width / 2 - 100, gameHeight / 2, 'hero').setScale(4);

        this.levelText = this.add.text(20, 20, `Level: ${this.level} (NG ${this.ng})`, { fontSize: '24px', fill: '#fff' });
        this.comboText = this.add.text(20, 50, '', { fontSize: '20px', fill: '#f0f' });

        this.spawnEverything();

        if (this.cache.audio.exists('bgm')) {
            this.sound.play('bgm', { loop: true, volume: 0.1 });
        }

        this.input.keyboard.on('keydown', (event) => {
            if (event.key >= '1' && event.key <= '5') this.handleSkill(event.key);
            if (event.key === 't') this.castTeleport();
            if (event.key === 'd') this.castDetect();
        });

        this.events.on('refresh-stats', () => this.refreshStats());
        this.events.on('die', () => this.handleDeath());
    }

    spawnEverything() {
        this.spawnMonster();
        this.spawnExploration();
    }

    spawnExploration() {
        const { width, height } = this.scale;
        const gameHeight = height * 0.7;

        // Hidden Wall
        if (Math.random() > 0.7) {
            const wall = this.add.sprite(Math.random() * width, Math.random() * gameHeight, 'tiles', 5).setScale(2).setInteractive();
            wall.on('pointerdown', () => {
                this.addPopup("HIDDEN PATH FOUND!", 0x00ffff);
                wall.destroy();
            });
        }

        // NPC Trader
        if (Math.random() > 0.8) {
            const npc = this.add.sprite(100, (height * 0.7) / 2, 'hero').setTint(0x00ff00).setScale(3).setInteractive();
            npc.on('pointerdown', () => {
                this.addPopup("NPC: Want to trade?", 0x00ff00);
            });
        }
    }

    refreshStats() {
        const saveData = SaveManager.getSaveData();
        const buffs = SaveManager.getGlobalBuffs();
        const equip = SaveManager.getEquipmentStats();

        // Base Stats + Equipment Standard Stats
        this.heroStats.atk = (this.baseStats.atk + equip.atk) * buffs.atkMultiplier;
        this.heroStats.spd = this.baseStats.spd + equip.spd;
        this.heroStats.maxHp = (this.baseStats.maxHp + equip.def * 12) * buffs.hpMultiplier;
        this.heroStats.lifesteal = this.baseStats.lifesteal;
        this.heroStats.luck = this.baseStats.luck;
        this.heroStats.berserk = 0;

        // Apply Unique Golden Affixes
        const items = [saveData.equipped.weapon, saveData.equipped.armor].filter(Boolean);
        items.forEach(item => {
            item.affixes.forEach(aff => {
                if (aff.isUnique) {
                    if (aff.type === 'VAMPIRIC') this.heroStats.lifesteal += aff.value;
                    if (aff.type === 'HASTE') this.heroStats.spd += aff.value;
                    if (aff.type === 'LUCKY') this.heroStats.luck *= aff.value;
                    if (aff.type === 'BERSERK') this.heroStats.berserk = aff.value;
                }
            });
        });

        if (this.heroStats.hp === undefined) this.heroStats.hp = this.heroStats.maxHp;
        console.log("Stats Refreshed:", this.heroStats);
    }

    update() {
        if (this.monster) this.monster.update();
        this.droppedItems.forEach((itemObj, index) => {
            const dist = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, itemObj.sprite.x, itemObj.sprite.y);
            if (dist < 40) this.pickupItem(itemObj, index);
        });
    }

    handleSkill(key) {
        if (!this.monster || this.monster.hp <= 0 || this.isDying) return;

        // HP Cost scales with level
        const cost = 5 + Math.floor(this.level / 10);
        this.heroStats.hp -= cost;
        if (this.heroStats.hp <= 0) {
            this.events.emit('die');
            return;
        }

        this.combo++;
        let dmg = this.heroStats.atk;

        // Berserk logic: scale dmg based on % missing HP
        if (this.heroStats.berserk > 0) {
            const missingRatio = 1 - (this.heroStats.hp / this.heroStats.maxHp);
            dmg *= (1 + missingRatio * this.heroStats.berserk);
        }

        if (this.combo > 5) dmg *= 1.5;

        this.comboText.setText(`COMBO x${this.combo}!`);
        if (this.cache.audio.exists('hit')) {
            this.sound.play('hit');
        }

        if (this.monster.takeDamage(dmg)) {
            // Lifesteal calculation
            const heal = dmg * this.heroStats.lifesteal;
            this.heroStats.hp = Math.min(this.heroStats.maxHp, this.heroStats.hp + heal);

            this.gold += (this.monster.data.xp || 10) * (this.heroStats.luck > 1.5 ? 2 : 1);
            this.addPopup("VICTORY!", 0xffff00);
            this.time.delayedCall(1000, () => {
                this.level++;
                if (this.level > 100) { this.level = 1; this.ng++; }
                this.levelText.setText(`Level: ${this.level} (NG ${this.ng})`);
                this.spawnEverything();
            });
        }
    }

    castTeleport() {
        this.addPopup("TELEPORT!", 0xaaaaff);
        this.hero.x = Math.random() * this.scale.width;
        this.hero.y = Math.random() * (this.scale.height * 0.7);
    }

    castDetect() {
        this.addPopup("DETECTING...", 0x00ff00);
        this.droppedItems.forEach(item => {
            this.tweens.add({ targets: item.sprite, alpha: 0.5, yoyo: true, repeat: 5 });
        });
    }

    handleDeath() {
        if (this.isDying) return;
        this.isDying = true;
        this.addPopup("DIED! REWINDING...", 0xff0000);

        // Black Rewind Effect
        const overlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000).setOrigin(0).setAlpha(0);
        this.tweens.add({
            targets: overlay,
            alpha: 1,
            duration: 1000,
            onComplete: () => {
                const cp = SaveManager.revertToCheckpoint();
                if (cp) {
                    this.level = cp.floor;
                    this.gold = cp.gold;
                }
                this.isDying = false;
                overlay.destroy();
                this.scene.restart();
            }
        });
    }

    // ... (Other helper methods rollup)
    rollLoot(x, y) {
        const item = LootManager.generateItem(this.level, this.heroStats.luck, this.ng);
        if (item) this.createMapDrop(x, y, item);
    }
    createMapDrop(x, y, item) {
        const sprite = this.add.sprite(x, y, 'tiles', 10).setScale(2);
        if (item.rarity.name === 'Golden') sprite.setTint(0xffd700);
        this.droppedItems.push({ sprite, item });
    }
    pickupItem(itemObj, index) {
        SaveManager.addItem(itemObj.item);
        this.addPopup(`Found ${itemObj.item.name}!`, itemObj.item.rarity.color);
        itemObj.sprite.destroy();
        this.droppedItems.splice(index, 1);
    }
    spawnMonster() {
        if (this.monster) this.monster.destroy();
        if (!this.monsterData || !Array.isArray(this.monsterData)) {
            console.error("Monster data not loaded!");
            this.addPopup("DATA ERROR: monsters.json missing", 0xff0000);
            return;
        }
        const tier = this.monsterData.find(t => this.level >= t.range[0] && this.level <= t.range[1]);
        const pool = tier ? tier.pool : this.monsterData[0].pool;
        const monsterInfo = { ...Phaser.Utils.Array.GetRandom(pool) };

        // NG+ Multiplier: 2x
        const ngMult = Math.pow(2, this.ng);
        monsterInfo.hp *= ngMult;
        monsterInfo.maxHp *= ngMult;
        monsterInfo.atk *= ngMult;

        const { width, height } = this.scale;
        this.monster = new Monster(this, width / 2 + 100, (height * 0.7) / 2, monsterInfo);
    }
    createMap() {
        const { width, height } = this.scale;
        this.add.tileSprite(0, 0, width, height * 0.7, 'tiles').setOrigin(0, 0).setAlpha(0.2);
    }
    addPopup(txt, color) {
        const { width, height } = this.scale;
        const t = this.add.text(width / 2, (height * 0.7) / 2 - 100, txt, {
            fontSize: '28px',
            fontStyle: 'bold',
            color: Phaser.Display.Color.IntegerToColor(color).rgba
        }).setOrigin(0.5);

        this.tweens.add({
            targets: t,
            y: t.y - 50,
            alpha: 0,
            duration: 1500,
            onComplete: () => t.destroy()
        });
    }
}
