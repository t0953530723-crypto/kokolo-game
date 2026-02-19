import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Progress bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            this.scene.start('GameScene');
            this.scene.start('UIScene');
        });

        // Asset Loading (Vite serves /public contents at the root)
        const assetBase = 'assets/';

        // Skip missing audio to prevent loading stalls
        this.load.on('loaderror', (fileObj) => {
            if (fileObj.type === 'audio') {
                console.warn('Audio asset failed to load, skipping:', fileObj.key);
            }
        });

        // Tileset
        this.load.image('tiles', assetBase + 'dungeon-16-16.png');

        // Characters/Monsters (Kenney uses 16x16)
        this.load.spritesheet('hero', assetBase + 'minifantasy-human.png', { frameWidth: 16, frameHeight: 16 });
        this.load.spritesheet('slime', assetBase + 'slime.png', { frameWidth: 16, frameHeight: 16 });
        this.load.image('boss', assetBase + 'beholder.png');

        // Audio (Optional)
        this.load.audio('bgm', assetBase + 'DungeonTheme.mp3');
        this.load.audio('hit', assetBase + 'hit.mp3');

        // UI Texture
        this.load.image('stone_panel', assetBase + 'brick64.png');

        // Monster Data
        this.load.json('monsters', 'monsters.json');
    }
}
