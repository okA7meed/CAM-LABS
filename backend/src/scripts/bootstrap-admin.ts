/**
 * First-Time Super Admin Bootstrap Script
 * 
 * This script creates the initial Super Admin user when no admin users exist.
 * It is designed to be run once during initial setup and should NOT be used
 * in production after the first admin account is created.
 * 
 * SECURITY NOTES:
 * - Only works when there are NO existing admin users
 * - Uses the same secure password hashing as the main authentication system
 * - Does not expose or store plaintext passwords
 * - Creates proper audit log entry
 * - Uses existing authentication architecture
 * - Should be removed or disabled after initial setup
 * 
 * USAGE:
 * Set environment variables and run:
 * BOOTSTRAP_ADMIN_NAME="Admin Name" \
 * BOOTSTRAP_ADMIN_EMAIL="admin@cam-labs.com" \
 * BOOTSTRAP_ADMIN_PASSWORD="SecurePassword123!" \
 * npm run bootstrap-admin
 */

import { getPrismaClient } from '../config/database';
import { ROLES } from '../auth/roles';
import { AdminService } from '../services/admin.service';
import { AdminAuthService } from '../services/admin-auth.service';

async function bootstrapAdmin() {
  try {
    console.log('=== CAM LABS - First-Time Super Admin Bootstrap ===\n');
    console.log('This script will create the initial Super Admin user.');
    console.log('It can only be run when no admin users exist.\n');

    // Get environment variables
    const name = process.env.BOOTSTRAP_ADMIN_NAME;
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const company = process.env.BOOTSTRAP_ADMIN_COMPANY || 'CAM LABS';
    const phone = process.env.BOOTSTRAP_ADMIN_PHONE || undefined;

    // Validate required environment variables
    if (!name || !email || !password) {
      console.log('❌ Missing required environment variables:');
      console.log('   BOOTSTRAP_ADMIN_NAME');
      console.log('   BOOTSTRAP_ADMIN_EMAIL');
      console.log('   BOOTSTRAP_ADMIN_PASSWORD');
      console.log('\nExample usage:');
      console.log('BOOTSTRAP_ADMIN_NAME="Admin Name" \\');
      console.log('BOOTSTRAP_ADMIN_EMAIL="admin@cam-labs.com" \\');
      console.log('BOOTSTRAP_ADMIN_PASSWORD="SecurePassword123!" \\');
      console.log('npm run bootstrap-admin');
      process.exit(1);
    }

    // Validate admin password requirements
    const passwordValidation = AdminAuthService.validateAdminPassword(password);
    if (!passwordValidation.valid) {
      console.log(`❌ Password validation failed: ${passwordValidation.error}`);
      console.log('Admin passwords must be at least 12 characters with uppercase, lowercase, number, and special character.');
      process.exit(1);
    }

    const prisma = getPrismaClient();

    // Check if any admin users already exist
    const existingAdmins = await prisma.user.count({
      where: { isAdmin: true },
    });

    if (existingAdmins > 0) {
      console.log('❌ Security: Admin users already exist in the database.');
      console.log('   This bootstrap script can only be run when no admin users exist.');
      console.log('   Please use the Admin Panel to manage existing admin users.');
      process.exit(1);
    }

    console.log('✓ No existing admin users found. Bootstrap is allowed.\n');

    console.log('✓ Creating Super Admin user...');

    // Create the Super Admin user using the AdminService
    const adminUser = await AdminService.createAdminUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: ROLES.SUPER_ADMIN,
      company,
      phone,
      notes: 'Initial Super Admin created via bootstrap script',
    });

    console.log('✓ Super Admin user created successfully!');
    console.log(`  - ID: ${adminUser.id}`);
    console.log(`  - Name: ${adminUser.name}`);
    console.log(`  - Email: ${adminUser.email}`);
    console.log(`  - Role: ${adminUser.role}`);
    console.log(`  - Is Admin: ${adminUser.isAdmin}`);

    console.log('\n=== Bootstrap Complete ===');
    console.log('\nYou can now:');
    console.log('1. Log in to the website with the credentials you specified');
    console.log('2. Open the Admin Panel at /admin once logged in');
    console.log('3. Create additional admin users through the Admin Panel');
    console.log('\nIMPORTANT: Delete or disable this bootstrap script after initial setup.');

    process.exit(0);

  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

// Run the bootstrap
bootstrapAdmin();