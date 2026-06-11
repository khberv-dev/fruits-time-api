export interface DeliveryClient {
  phone: string;
  name: string;
  email?: string;
}

export interface DeliveryLocation {
  long: number;
  lat: number;
}

export interface DeliveryOrderItem {
  name: string;
  price_per_unit: number;
  quantity: number;
  width: number;
  height: number;
  length: number;
  weight: number;
}

export interface DeliveryCreateOrderInput {
  vendorOrderId: string;
  items: DeliveryOrderItem[];
  deliveryCost?: number;
  origin: {
    location: DeliveryLocation;
    address: string;
    client: DeliveryClient;
  };
  destination: {
    location: DeliveryLocation;
    address: string;
    client: DeliveryClient;
  };
}
