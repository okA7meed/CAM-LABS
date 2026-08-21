import { User, Order, Quote, CadFile } from '../types';

export const DEMO_PERSONAS: User[] = [
  {
    id: "persona-1",
    name: "Dr. Elena Vance",
    role: "Lead Robotics Engineer",
    company: "Vance Autonomous Systems Inc.",
    email: "e.vance@vance-robotics.tech",
    phone: "+1 (415) 890-2144",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    tier: "Enterprise Pro",
    address: "742 Innovation Way, Bldg 4, San Francisco, CA 94107",
    taxId: "US-88491024",
    preferences: {
      units: "mm",
      toleranceStandard: "ISO 2768-fine (±0.05 mm)",
      dfmNotifications: true,
      dispatchAlerts: true
    }
  },
  {
    id: "persona-2",
    name: "Marcus Sterling",
    role: "Procurement & Supply Chain Lead",
    company: "Sterling Aerospace Components",
    email: "m.sterling@sterling-aero.com",
    phone: "+1 (206) 555-0199",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    tier: "Enterprise Tier 1",
    address: "1200 Boeing Access Rd, Seattle, WA 98108",
    taxId: "US-99120481",
    preferences: {
      units: "mm",
      toleranceStandard: "ISO 2768-fine (±0.05 mm)",
      dfmNotifications: true,
      dispatchAlerts: true
    }
  },
  {
    id: "persona-3",
    name: "Alex Chen",
    role: "Hardware Startup Founder",
    company: "NextGen Sensorics Lab",
    email: "alex@nextgen-sensors.io",
    phone: "+1 (510) 555-8321",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    tier: "Developer Tier",
    address: "2100 Shattuck Ave, Berkeley, CA 94704",
    taxId: "US-44910234",
    preferences: {
      units: "mm",
      toleranceStandard: "ISO 2768-medium (±0.15 mm)",
      dfmNotifications: true,
      dispatchAlerts: true
    }
  }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: "CAM-2026-8894",
    partName: "Turbine_Manifold_v3.step",
    technology: "CNC Machining",
    material: "Aluminum 6061-T6 (Anodized Black)",
    quantity: 12,
    date: "2026-08-12",
    estDelivery: "2026-08-18",
    status: "In Production",
    statusBadge: "badge-blue",
    progressStep: 2,
    totalCost: "1,480.00 EGP",
    tolerance: "±0.025 mm",
    trackingNum: "DHL-EXPRESS-992014812",
    history: [
      { step: "CAD Geometry Verification", date: "Aug 12, 09:30", done: true, desc: "Automated DFM check passed. No thin wall collisions." },
      { step: "CAM Toolpath Generation", date: "Aug 12, 14:15", done: true, desc: "5-Axis G-code optimized with Hermle C400 setup." },
      { step: "Precision CNC Milling", date: "Aug 13, 08:00", done: true, desc: "Billet milling underway. Spindle feed rate: 18,000 RPM." },
      { step: "CMM Laser Dimensional QA", date: "Pending", done: false, desc: "Zeiss CMM touch-probe inspection scheduled." },
      { step: "Dispatched via Express Courier", date: "Pending", done: false, desc: "Direct courier dispatch to facility." }
    ]
  },
  {
    id: "CAM-2026-8895",
    partName: "Robotic_Actuator_Bracket.stl",
    technology: "Industrial 3D Printing (SLS)",
    material: "PA 12 (Nylon 12) Vapor Smoothed",
    quantity: 40,
    date: "2026-08-13",
    estDelivery: "2026-08-16",
    status: "Quality Inspection",
    statusBadge: "badge-warning",
    progressStep: 3,
    totalCost: "640.00 EGP",
    tolerance: "±0.15 mm",
    trackingNum: "FEDEX-PRIORITY-44810291",
    history: [
      { step: "CAD Geometry Verification", date: "Aug 13, 10:00", done: true, desc: "SLS nesting packing density optimized to 14.8%." },
      { step: "EOS P396 Laser Sintering", date: "Aug 13, 16:30", done: true, desc: "Laser sintering chamber cycle completed." },
      { step: "De-powdering & Vapor Smoothing", date: "Aug 14, 04:00", done: true, desc: "Solvent vapor polish applied for Ra 1.2 μm finish." },
      { step: "CMM & Tensile Sample QA", date: "In Progress", done: false, desc: "Dimensional verification in progress." },
      { step: "Dispatched via Express Courier", date: "Pending", done: false, desc: "Awaiting packaging." }
    ]
  },
  {
    id: "CAM-2026-8890",
    partName: "Optical_Sensor_Housing.step",
    technology: "Precision SLA",
    material: "Tough ABS-Like 100",
    quantity: 6,
    date: "2026-08-08",
    estDelivery: "2026-08-11",
    status: "Delivered",
    statusBadge: "badge-success",
    progressStep: 4,
    totalCost: "285.00 EGP",
    tolerance: "±0.08 mm",
    trackingNum: "UPS-EXPRESS-110294812",
    history: [
      { step: "CAD Geometry Verification", date: "Aug 08, 08:15", done: true, desc: "High-resolution SLA slicing at 50μm layer pitch." },
      { step: "Formlabs 3L Resin Printing", date: "Aug 08, 14:00", done: true, desc: "UV laser cured." },
      { step: "IPA Wash & UV Post-Cure", date: "Aug 09, 09:00", done: true, desc: "60°C thermal cure chamber completed." },
      { step: "Optical Laser Scan Inspection", date: "Aug 09, 15:30", done: true, desc: "Dimensional report DIN ISO 2768-f verified." },
      { step: "Delivered & Signed", date: "Aug 11, 11:20", done: true, desc: "Delivered to Reception, signed by E. Vance." }
    ]
  }
];

export const INITIAL_QUOTES: Quote[] = [
  {
    id: "RFQ-2026-7741",
    partName: "Exoskeleton_Shoulder_Hinge.step",
    technology: "DMLS Metal 3D Printing",
    material: "Titanium Ti-6Al-4V (Grade 5)",
    quantity: 4,
    leadTime: "5 - 7 Days",
    unitPrice: "245.00 EGP",
    totalPrice: "980.00 EGP",
    validUntil: "2026-08-25",
    status: "Ready for Approval"
  },
  {
    id: "RFQ-2026-7742",
    partName: "Chassis_Server_Panel_19in.dxf",
    technology: "Sheet Metal & Laser Cutting",
    material: "Aluminum 5052-H32 (Black Powder Coat)",
    quantity: 25,
    leadTime: "3 - 4 Days",
    unitPrice: "34.50 EGP",
    totalPrice: "862.50 EGP",
    validUntil: "2026-08-28",
    status: "Ready for Approval"
  }
];

export const INITIAL_CAD_FILES: CadFile[] = [
  {
    id: "file-001",
    name: "Turbine_Manifold_v3.step",
    format: "STEP",
    size: "14.2 MB",
    uploaded: "2026-08-12",
    volume: "142.6 cm³",
    dimensions: "120 × 85 × 45 mm",
    meshTriangles: "248,190",
    status: "Verified CAD"
  },
  {
    id: "file-002",
    name: "Robotic_Actuator_Bracket.stl",
    format: "STL",
    size: "6.8 MB",
    uploaded: "2026-08-13",
    volume: "58.4 cm³",
    dimensions: "95 × 40 × 32 mm",
    meshTriangles: "112,040",
    status: "Verified CAD"
  },
  {
    id: "file-003",
    name: "Optical_Sensor_Housing.step",
    format: "STEP",
    size: "8.4 MB",
    uploaded: "2026-08-08",
    volume: "24.1 cm³",
    dimensions: "45 × 45 × 38 mm",
    meshTriangles: "76,820",
    status: "Verified CAD"
  },
  {
    id: "file-004",
    name: "Exoskeleton_Shoulder_Hinge.step",
    format: "STEP",
    size: "19.5 MB",
    uploaded: "2026-08-14",
    volume: "88.2 cm³",
    dimensions: "110 × 65 × 52 mm",
    meshTriangles: "310,400",
    status: "Verified CAD"
  }
];
