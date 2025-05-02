import { Component, OnInit, AfterViewInit, Output, EventEmitter, Input, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// マーカーアイコンのパスを修正
const iconRetinaUrl = 'assets/leaflet/marker-icon-2x.png';
const iconUrl = 'assets/leaflet/marker-icon.png';
const shadowUrl = 'assets/leaflet/marker-shadow.png';

// デフォルトアイコンの設定
const defaultIcon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

// Material Designスタイルのピンアイコン設定
const pinIcon = L.divIcon({
  className: 'material-pin',
  html: `
    <div style="
      width: 32px;
      height: 32px;
      background: #1976d2;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    ">
      <div style="
        width: 8px;
        height: 8px;
        background: white;
        border-radius: 50%;
      "></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
  tooltipAnchor: [16, -16]
});

// デフォルトアイコンを設定
L.Marker.prototype.options.icon = pinIcon;

@Component({
  selector: 'app-map-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    <div class="map-container">
      <div id="map" style="height: 100%;"></div>
      <div class="map-controls">
        <button mat-raised-button color="primary" (click)="selectCurrentLocation()" class="select-location-btn">
          <span class="btn-text">この位置を選択</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .map-container {
      height: 100%;
      width: 100%;
      position: relative;
    }
    .map-controls {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      padding: 10px;
      background-color: transparent;
      border-radius: 8px;
    }
    .select-location-btn {
      min-width: 200px !important;
      height: 48px !important;
      font-size: 16px !important;
      font-weight: bold !important;
      background-color: #1976d2 !important;
      color: white !important;
      border-radius: 24px !important;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
      transition: all 0.3s ease !important;
    }
    .select-location-btn:hover {
      background-color: #1565c0 !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3) !important;
    }
    .select-location-btn:active {
      background-color: #0d47a1 !important;
      transform: translateY(0) !important;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
    }
    .btn-text {
      display: inline-block;
      padding: 0 20px;
    }
  `]
})
export class MapDialogComponent implements AfterViewInit {
  private map!: L.Map;
  private marker: L.Marker | null = null;
  private currentLocation: { lat: number; lng: number; address?: string } | null = null;

  constructor(
    public dialogRef: MatDialogRef<MapDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { lat: number; lng: number; address?: string } | null
  ) {}

  ngAfterViewInit() {
    this.initMap();
  }

  private async initMap() {
    const defaultLocation = { lat: 35.6812, lng: 139.7671 };
    const initialLocation = this.data || defaultLocation;

    this.map = L.map('map').setView([initialLocation.lat, initialLocation.lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    try {
      const position = await this.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      this.map.setView([latitude, longitude], 15);
      await this.addMarker(latitude, longitude);
    } catch (error) {
      console.error('位置情報の取得に失敗しました:', error);
      await this.addMarker(initialLocation.lat, initialLocation.lng);
    }

    this.map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      await this.addMarker(lat, lng);
    });
  }

  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  }

  private async addMarker(lat: number, lng: number) {
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }

    this.marker = L.marker([lat, lng], {
      draggable: true
    }).addTo(this.map);

    this.marker.on('dragend', async () => {
      const position = this.marker!.getLatLng();
      await this.updateCurrentLocation(position.lat, position.lng);
    });

    await this.updateCurrentLocation(lat, lng);
  }

  private async updateCurrentLocation(lat: number, lng: number) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await response.json();
      this.currentLocation = {
        lat: lat,
        lng: lng,
        address: data.display_name
      };
      console.log('Current location updated:', this.currentLocation);
    } catch (error) {
      console.error('住所の取得に失敗しました:', error);
      this.currentLocation = {
        lat: lat,
        lng: lng
      };
    }
  }

  selectCurrentLocation() {
    console.log('Selecting location:', this.currentLocation);
    if (this.currentLocation) {
      this.dialogRef.close(this.currentLocation);
    }
  }
}

@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="location-picker">
      <button mat-stroked-button (click)="openMap()">
        <mat-icon>location_on</mat-icon>
        {{ location ? '位置情報を変更' : '位置情報を追加' }}
      </button>
      <div *ngIf="location" class="location-info">
        <p>{{location.address}}</p>
        <button mat-icon-button color="warn" (click)="clearLocation()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .location-picker {
      margin: 16px 0;
    }
    .location-info {
      margin-top: 8px;
      padding: 8px;
      background-color: #f5f5f5;
      border-radius: 4px;
      position: relative;
    }
    .location-info p {
      margin: 4px 0;
      padding-right: 40px;
      word-break: break-all;
    }
    button[color="warn"] {
      position: absolute;
      top: 4px;
      right: 4px;
    }
  `]
})
export class LocationPickerComponent implements OnInit {
  @Input() location: { lat: number; lng: number; address?: string } | null = null;
  @Output() locationChange = new EventEmitter<{ lat: number; lng: number; address?: string } | null>();

  constructor(private dialog: MatDialog) {}

  ngOnInit() {}

  openMap() {
    const dialogRef = this.dialog.open(MapDialogComponent, {
      width: '90%',
      maxWidth: '600px',
      height: '400px',
      data: this.location
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('Dialog result:', result);
      if (result) {
        this.location = result;
        this.locationChange.emit(result);
      }
    });
  }

  clearLocation() {
    this.location = null;
    this.locationChange.emit(null);
  }
} 