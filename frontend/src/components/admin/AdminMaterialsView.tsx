import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';
import { AdminLayout } from './AdminLayout';

export const AdminMaterialsView: React.FC = () => {
  const { showToast } = useStore();
  const { t } = useTranslation();
  const [materials, setMaterials] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [techFilter, setTechFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (techFilter) params.set('technology', techFilter);
      const res = await fetch(`/api/v1/admin/materials?${params}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setMaterials(data.data.materials || []);
      setTotal(data.data.total || 0);
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [techFilter]);

  return (
    <AdminLayout title="Materials Management" subtitle={t('admin.totalMaterials', { total })}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <select className="form-control" value={techFilter} onChange={(e) => setTechFilter(e.target.value)}
          style={{ width: '200px', padding: '8px 12px', background: 'var(--cam-surface-2)', border: '1px solid var(--cam-border-subtle)', borderRadius: '6px', color: 'var(--cam-text-primary)' }}>
          <option value="">{t('admin.filters.allTechnologies')}</option>
          <option value="FDM">FDM</option>
          <option value="SLA">SLA</option>
          <option value="SLS">SLS</option>
          <option value="CNC_MILLING">CNC Milling</option>
          <option value="CNC_TURNING">CNC Turning</option>
          <option value="LASER_CUTTING">Laser Cutting</option>
        </select>
        <button className="btn btn-sm btn-outline" onClick={load}><Icon name="reset" size={14} /> Refresh</button>
      </div>

      <div className="table-responsive" style={{ background: 'var(--cam-surface-1)', borderRadius: '12px', border: '1px solid var(--cam-border-subtle)' }}>
        <table className="cam-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Technology</th>
              <th>Category</th>
              <th>Density</th>
              <th>Tensile</th>
              <th>HDT</th>
              <th>Price/Unit</th>
              <th>Lead Time</th>
              <th>Active</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>Loading...</td></tr>
            ) : materials.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>No materials found</td></tr>
            ) : (
              materials.map((m: any) => (
                <tr key={m.id}>
                  <td><strong style={{ color: 'var(--cam-text-secondary)' }}>{m.name}</strong></td>
                  <td><span className="badge badge-neutral">{m.technology}</span></td>
                  <td style={{ fontSize: '12px' }}>{m.category}</td>
                  <td>{m.density} g/cm³</td>
                  <td>{m.tensileStrength} MPa</td>
                  <td>{m.hdt}°C</td>
                  <td>{m.pricePerUnit ? `${m.pricePerUnit} ${m.priceUnit || ''}` : '—'}</td>
                  <td style={{ fontSize: '12px' }}>{m.leadTime}</td>
                  <td>
                    <span className={`badge ${m.isActive ? 'badge-primary' : 'badge-error'}`}>
                      {m.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${m.availability === 'IN_STOCK' ? 'badge-primary' : 'badge-warning'}`}>
                      {m.availability}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};