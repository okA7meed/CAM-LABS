import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../../auth/password.service';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CAM LABS PostgreSQL database...');

  // Seed Users
  const user1 = await prisma.user.upsert({
    where: { email: 'e.vance@vance-robotics.tech' },
    update: {},
    create: {
      id: 'persona-1',
      name: 'Dr. Elena Vance',
      email: 'e.vance@vance-robotics.tech',
      role: 'ENGINEER',
      accountStatus: 'ACTIVE',
      passwordHash: await hashPassword(process.env.SEED_DEMO_PASSWORD || randomBytes(32).toString('hex')),
      company: 'Vance Autonomous Systems Inc.',
      phone: '+1 (415) 890-2144',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      tier: 'Enterprise Pro',
      address: '742 Innovation Way, Bldg 4, San Francisco, CA 94107',
      taxId: 'US-88491024',
      preferences: {
        units: 'mm',
        toleranceStandard: 'ISO 2768-fine (±0.05 mm)',
        dfmNotifications: true,
        dispatchAlerts: true,
      },
    },
  });

  // Seed Materials
  const materials = [
    {
      id: 'pa12-sls',
      name: 'PA 12 (Nylon 12)',
      technology: 'SLS',
      category: 'Polymers',
      description: 'Versatile engineering thermoplastic with balanced mechanical properties, high chemical resistance, and excellent fatigue resistance.',
      tensileStrength: 48,
      hdt: 175,
      elongation: 18,
      density: 1.01,
      standardTolerance: '± 0.15 mm',
      minWallThickness: '0.8 mm',
      leadTime: '24 - 48 Hours',
      surfaceFinish: 'Matte Bead Blasted / Vapor Smoothed',
      tags: ['High Durability', 'Chemical Resistant', 'Complex Geometry', 'No Supports'],
      colorOptions: ['Charcoal Grey', 'Deep Black', 'Off-White'],
      idealFor: 'Functional enclosures, robotic joints, snap-fit components, automotive ducting',
    },
    {
      id: 'alu-6061-cnc',
      name: 'Aluminum 6061-T6',
      technology: 'CNC',
      category: 'Metals',
      description: 'Standard aerospace and mechanical engineering aluminum alloy with high strength, excellent weldability, and superior machinability.',
      tensileStrength: 310,
      hdt: 300,
      elongation: 12,
      density: 2.70,
      standardTolerance: '± 0.025 mm',
      minWallThickness: '0.8 mm',
      leadTime: '3 - 5 Days',
      surfaceFinish: 'As-Machined (Ra 1.6), Type II Anodized, Bead Blasted',
      tags: ['ISO 2768-m', 'Anodizable', 'High Strength-to-Weight', '5-Axis'],
      colorOptions: ['Clear Anodized', 'Black Anodized', 'Blue Anodized', 'Raw Metal'],
      idealFor: 'Structural aerospace fittings, camera mounts, motor chassis, robotics frames',
    },
    {
      id: 'peek-fdm',
      name: 'PEEK (Polyetheretherketone)',
      technology: 'FDM',
      category: 'High-Performance',
      description: 'Ultra-high performance semi-crystalline polymer with extreme thermal stability, flame retardance, and metal-replacement strength.',
      tensileStrength: 100,
      hdt: 250,
      elongation: 15,
      density: 1.30,
      standardTolerance: '± 0.20 mm',
      minWallThickness: '1.2 mm',
      leadTime: '3 - 5 Days',
      surfaceFinish: 'Milled Ra 3.2 / Annealed',
      tags: ['Ultra High Temp', 'Metal Replacement', 'Sterilizable', 'Aerospace'],
      colorOptions: ['Natural Beige', 'Black'],
      idealFor: 'Aerospace brackets, semiconductor manifolds, surgical implants, oil & gas seals',
    },
  ];

  for (const m of materials) {
    await prisma.material.upsert({
      where: { id: m.id },
      update: {},
      create: m,
    });
  }

  // Seed Orders
  await prisma.order.upsert({
    where: { id: 'CAM-2026-8894' },
    update: {},
    create: {
      id: 'CAM-2026-8894',
      userId: user1.id,
      partName: 'Turbine_Manifold_v3.step',
      technology: 'CNC Machining',
      material: 'Aluminum 6061-T6 (Anodized Black)',
      quantity: 12,
      date: '2026-08-12',
      estDelivery: '2026-08-18',
      status: 'In Production',
      statusBadge: 'badge-blue',
      progressStep: 2,
      totalCost: '$1,480.00',
      tolerance: '±0.025 mm',
      trackingNum: 'DHL-EXPRESS-992014812',
      history: [
        { step: 'CAD Geometry Verification', date: 'Aug 12, 09:30', done: true, desc: 'Automated DFM check passed.' },
        { step: 'CAM Toolpath Generation', date: 'Aug 12, 14:15', done: true, desc: '5-Axis G-code optimized.' },
        { step: 'Precision CNC Milling', date: 'Aug 13, 08:00', done: true, desc: 'Billet milling underway.' },
        { step: 'CMM Laser Dimensional QA', date: 'Pending', done: false, desc: 'Zeiss CMM touch-probe inspection.' },
        { step: 'Dispatched via Express Courier', date: 'Pending', done: false, desc: 'Direct courier dispatch.' },
      ],
    },
  });

  console.log('CAM LABS Database seeded successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
