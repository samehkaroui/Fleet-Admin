
interface LeafletMapOptions {
  center?: [number, number];
  zoom?: number;
  zoomControl?: boolean;
  scrollWheelZoom?: boolean;
  doubleClickZoom?: boolean;
  dragging?: boolean;
}

interface LeafletPopupOptions {
  maxWidth?: number;
  className?: string;
}

interface LeafletIconOptions {
  html?: string;
  className?: string;
  iconSize?: [number, number];
  iconAnchor?: [number, number];
}

interface LeafletTileLayerOptions {
  attribution?: string;
  maxZoom?: number;
  minZoom?: number;
}

declare module 'leaflet' {
  interface Map {
    setView(center: [number, number], zoom: number, options?: LeafletMapOptions): this;
    remove(): void;
    getZoom(): number;
    zoomIn(): this;
    zoomOut(): this;
    removeLayer(layer: Marker | TileLayer): this;
  }

  interface Marker {
    addTo(map: Map): this;
    bindPopup(content: string, options?: LeafletPopupOptions): this;
    openPopup(): this;
    on(event: string, handler: () => void): this;
  }

  interface TileLayer {
    addTo(map: Map): this;
  }

  interface DivIcon {
    options: LeafletIconOptions;
  }

  function map(element: HTMLElement, options?: LeafletMapOptions): Map;
  function tileLayer(url: string, options?: LeafletTileLayerOptions): TileLayer;
  function marker(position: [number, number], options?: { icon?: DivIcon }): Marker;
  function divIcon(options?: LeafletIconOptions): DivIcon;
}

declare global {
  interface Window {
    L: {
      map: (element: HTMLElement, options?: LeafletMapOptions) => any;
      tileLayer: (url: string, options?: LeafletTileLayerOptions) => any;
      marker: (position: [number, number], options?: any) => any;
      divIcon: (options?: LeafletIconOptions) => any;
    };
  }
}
