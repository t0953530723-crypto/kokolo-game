import Phaser from 'phaser';
import SaveManager from '../SaveManager';

export default class UIScene extends Phaser.Scene {
    constructor() {
        super('UIScene');
    }

    create() {
        const { width, height } = this.scale;
        const uiHeight = height * 0.3;
        const uiY = height * 0.7;

        // Create a container for UI
        this.uiContainer = this.add.container(0, uiY);

        // Stone Panel Background
        const bg = this.add.tileSprite(0, 0, width, uiHeight, 'stone_panel');
        bg.setOrigin(0, 0);
        bg.setAlpha(0.9);
        this.uiContainer.add(bg);

        // HP Bar
        this.addBar(20, 20, 200, 20, 0xff0000, 'HP: 100/100');
        // MP Bar
        this.addBar(20, 50, 200, 20, 0x0000ff, 'MP: 50/50');

        // Hotkeys
        for (let i = 0; i < 5; i++) {
            this.addHotkey(250 + (i * 60), 20, i + 1);
        }

        // Menu Buttons
        const btnBestiary = this.addButton(width - 440, 20, 'BESTIARY', () => this.toggleOverlay('bestiary'));
        const btnTalent = this.addButton(width - 330, 20, 'TALENT', () => this.toggleOverlay('talent'));
        const btnEscape = this.addButton(width - 220, 20, 'ESCAPE', () => this.toggleOverlay('escape'));
        const btnInv = this.addButton(width - 110, 20, 'EQUIP', () => this.toggleOverlay('inventory'));
        this.uiContainer.add([btnBestiary, btnTalent, btnEscape, btnInv]);

        // Border
        const graphics = this.add.graphics();
        graphics.lineStyle(4, 0x444444);
        graphics.strokeRect(0, 0, width, uiHeight);
        this.uiContainer.add(graphics);

        // Overlay Setup
        this.overlay = this.add.container(width / 2, -height * 0.35);
        this.overlay.setVisible(false);
        this.overlayBg = this.add.rectangle(0, 0, width * 0.8, height * 0.6, 0x000000, 0.9);
        this.overlay.add(this.overlayBg);
        this.overlayContent = this.add.container(0, 0);
        this.overlay.add(this.overlayContent);
    }

    addButton(x, y, label, callback) {
        const container = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 100, 40, 0x444444).setOrigin(0);
        const text = this.add.text(50, 20, label, { fontSize: '14px' }).setOrigin(0.5);
        container.add([bg, text]);
        bg.setInteractive({ useHandCursor: true })
            .on('pointerdown', callback);
        return container;
    }

    toggleOverlay(type) {
        if (this.overlay.visible && this.currentOverlay === type) {
            this.overlay.setVisible(false);
            return;
        }
        this.currentOverlay = type;
        this.overlay.setVisible(true);
        this.overlayContent.removeAll(true);

        const saveData = SaveManager.getSaveData();
        if (type === 'talent') this.renderTalentTree(saveData);
        else if (type === 'escape') this.renderEscapeWings(saveData);
        else if (type === 'inventory') this.renderInventory(saveData);
        else if (type === 'bestiary') this.renderBestiary(saveData);

        const closeText = this.add.text(0, 220, "CLOSE", { fontSize: '18px', color: '#f00' }).setOrigin(0.5);
        closeText.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.overlay.setVisible(false));
        this.overlayContent.add(closeText);
    }

    renderTalentTree(saveData) {
        this.overlayContent.add(this.add.text(0, -220, "TALENT TREE", { fontSize: '24px', fontStyle: 'bold' }).setOrigin(0.5));

        // Central Point
        const center = this.add.circle(0, 0, 20, 0xffffff);
        this.overlayContent.add(center);

        // Branches: Red (Martial), Blue (Magic), Green (Treasure)
        const branches = [
            { angle: -120, color: 0xff0000, label: 'Martial (+Atk)', id: '武' },
            { angle: 0, color: 0x0000ff, label: 'Magic (Skill)', id: '魔' },
            { angle: 120, color: 0x00ff00, label: 'Treasure (Luck)', id: '寶' }
        ];

        branches.forEach(b => {
            const rad = Phaser.Math.DegToRad(b.angle);
            const x = Math.cos(rad) * 120;
            const y = Math.sin(rad) * 120;

            // Line from center
            const line = this.add.graphics();
            line.lineStyle(2, b.color);
            line.lineBetween(0, 0, x, y);
            this.overlayContent.add(line);

            const node = this.add.circle(x, y, 30, b.color).setInteractive();
            const txt = this.add.text(x, y, b.id, { fontSize: '20px', color: '#fff' }).setOrigin(0.5);
            this.overlayContent.add([node, txt]);

            node.on('pointerdown', () => {
                if (SaveManager.unlockTalent(b.id)) {
                    this.showPopup(`Unlocked ${b.label}!`);
                    this.toggleOverlay('talent');
                }
            });
        });
    }

    renderEscapeWings(saveData) {
        this.overlayContent.add(this.add.text(0, -180, "ESCAPE WINGS", { fontSize: '24px' }).setOrigin(0.5));

        let artifacts = saveData.inventory.filter(i => i.rarity.name === 'Golden');
        let normal = saveData.inventory.filter(i => i.rarity.name !== 'Golden');
        let goldValue = normal.length * 50;

        this.overlayContent.add(this.add.text(0, -100, `Artifacts kept: ${artifacts.length}`, { fontSize: '18px', color: '#ffd700' }).setOrigin(0.5));
        this.overlayContent.add(this.add.text(0, -60, `Normal items sold for: ${goldValue} Gold`, { fontSize: '18px' }).setOrigin(0.5));

        const btnConfirm = this.addActionButton(0, 50, "CONFIRM ESCAPE", () => {
            const data = SaveManager.getSaveData();
            data.inventory = artifacts;
            data.stats.gold += goldValue;
            SaveManager.save(data);
            this.scene.get('GameScene').events.emit('update-leaderboard');
            this.overlay.setVisible(false);
            this.showPopup("Escaped safely!");
        });
        this.overlayContent.add(btnConfirm);
    }

    renderBestiary(saveData) {
        this.overlayContent.add(this.add.text(0, -180, "BESTIARY", { fontSize: '24px' }).setOrigin(0.5));
        let y = -140;
        Object.values(saveData.bestiary).forEach(e => {
            this.overlayContent.add(this.add.text(-200, y, `${e.data.name}: ${e.killCount} Kills`, { fontSize: '16px' }));
            y += 25;
        });
    }

    showPopup(txt) {
        const t = this.add.text(this.scale.width / 2, 200, txt, { fontSize: '24px', backgroundColor: '#000', padding: 10 }).setOrigin(0.5);
        this.time.delayedCall(2000, () => t.destroy());
    }

    addButton(x, y, label, callback) {
        const container = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 100, 40, 0x444444).setOrigin(0);
        const text = this.add.text(50, 20, label, { fontSize: '14px' }).setOrigin(0.5);
        container.add([bg, text]);
        bg.setInteractive({ useHandCursor: true })
            .on('pointerdown', callback);
        return container;
    }

    toggleOverlay(type) {
        if (this.overlay.visible && this.currentOverlay === type) {
            this.overlay.setVisible(false);
            return;
        }
        this.currentOverlay = type;
        this.overlay.setVisible(true);
        this.overlayContent.removeAll(true);

        const saveData = SaveManager.getSaveData();
        let title = type.toUpperCase();
        this.overlayContent.add(this.add.text(0, -180, title, { fontSize: '24px', fontStyle: 'bold' }).setOrigin(0.5));

        if (type === 'bestiary') {
            let yOffset = -140;
            Object.values(saveData.bestiary).forEach(entry => {
                const txt = `${entry.data.name}: Kills: ${entry.killCount} (ATK:${entry.data.atk})`;
                this.overlayContent.add(this.add.text(-250, yOffset, txt, { fontSize: '16px' }));
                yOffset += 25;
            });
        } else if (type === 'leaderboard') {
            let yOffset = -140;
            saveData.leaderboard.forEach((entry, i) => {
                const txt = `${i + 1}. Floor: ${entry.floor} | Gold: ${entry.gold} | NG+: ${entry.ng}`;
                this.overlayContent.add(this.add.text(-250, yOffset, txt, { fontSize: '16px' }));
                yOffset += 25;
            });
        } else if (type === 'inventory') {
            this.renderInventory(saveData);
        }

        const closeText = this.add.text(0, 200, "CLOSE", { fontSize: '18px', color: '#f00' }).setOrigin(0.5);
        closeText.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.overlay.setVisible(false));
        this.overlayContent.add(closeText);
    }

    renderInventory(saveData) {
        let x = -280, y = -140;
        saveData.inventory.forEach((item, i) => {
            const itemBox = this.add.container(x, y);
            const bg = this.add.rectangle(0, 0, 120, 40, item.rarity.name === 'Golden' ? 0xffd700 : 0x444444).setOrigin(0);
            if (item.rarity.name === 'Golden') bg.setStrokeStyle(2, 0xffffff); // Glow effect

            const label = item.id === saveData.equipped.weapon?.id ? `[E] ${item.name}` : item.name;
            const text = this.add.text(60, 20, label, { fontSize: '12px' }).setOrigin(0.5);
            itemBox.add([bg, text]);

            bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.showItemDetails(item));

            this.overlayContent.add(itemBox);
            x += 140;
            if (x > 200) { x = -280; y += 50; }
        });
    }

    showItemDetails(item) {
        this.overlayContent.removeAll(true);
        this.overlayContent.add(this.add.text(0, -180, item.name, { fontSize: '24px', color: Phaser.Display.Color.IntegerToColor(item.rarity.color).rgba }).setOrigin(0.5));

        let y = -130;
        this.overlayContent.add(this.add.text(0, y, `Rarity: ${item.rarity.name}`, { fontSize: '16px' }).setOrigin(0.5));
        y += 25;
        this.overlayContent.add(this.add.text(0, y, `ATK: ${item.baseStats.atk} | DEF: ${item.baseStats.def}`, { fontSize: '16px' }).setOrigin(0.5));
        y += 30;

        item.affixes.forEach(aff => {
            const color = aff.isUnique ? '#ffd700' : '#0f0';
            const text = aff.isUnique ? `★ ${aff.label}: ${aff.desc}` : `${aff.label}: +${aff.value}`;
            this.overlayContent.add(this.add.text(0, y, text, { fontSize: '16px', color: color }).setOrigin(0.5));
            y += 25;
        });

        // Actions
        const btnEquip = this.addActionButton(-100, 120, 'EQUIP', () => {
            SaveManager.equipItem(item);
            this.scene.get('GameScene').events.emit('refresh-stats');
            this.toggleOverlay('inventory');
        });
        const btnDrop = this.addActionButton(100, 120, 'DROP', () => {
            SaveManager.removeItem(item.id);
            this.scene.get('GameScene').events.emit('refresh-stats');
            this.toggleOverlay('inventory');
        });
        this.overlayContent.add([btnEquip, btnDrop]);
    }

    addActionButton(x, y, label, callback) {
        const btn = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 80, 30, 0x333333).setOrigin(0.5);
        const txt = this.add.text(0, 0, label, { fontSize: '14px' }).setOrigin(0.5);
        btn.add([bg, txt]);
        bg.setInteractive({ useHandCursor: true }).on('pointerdown', callback);
        return btn;
    }

    addBar(x, y, w, h, color, label) {
        const bg = this.add.graphics();
        bg.fillStyle(0x333333);
        bg.fillRect(x, y, w, h);
        this.uiContainer.add(bg);

        const bar = this.add.graphics();
        bar.fillStyle(color);
        bar.fillRect(x + 2, y + 2, w - 4, h - 4);
        this.uiContainer.add(bar);

        const text = this.add.text(x + w + 10, y, label, { fontSize: '14px', fill: '#fff' });
        this.uiContainer.add(text);
    }

    addHotkey(x, y, num) {
        const bg = this.add.graphics();
        bg.lineStyle(2, 0xffffff);
        bg.strokeRect(x, y, 50, 50);
        this.uiContainer.add(bg);

        const txt = this.add.text(x + 5, y + 5, num.toString(), { fontSize: '12px' });
        this.uiContainer.add(txt);
    }
}
