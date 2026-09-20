import React from 'react';
import {
  Box,
  Plus,
  Tag,
  Layers,
  Settings,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  MoreVertical,
  CheckCircle2,
  X,
  AlertTriangle,
  FolderEdit,
  DollarSign,
  Calendar
} from 'lucide-react';
import { api } from '../api';
import type { Product, Category, Plan, ProductCapability } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { PortalDropdown } from '../components/PortalDropdown';

export const ProductsView: React.FC = () => {
  const { format: formatMoney } = useCurrency();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [loading, setLoading] = React.useState(true);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Product Actions Dropdown
  const [openProductMenuId, setOpenProductMenuId] = React.useState<string | null>(null);
  const productMenuTriggerRef = React.useRef<HTMLButtonElement | null>(null);

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [editProdName, setEditProdName] = React.useState('');
  const [editProdCategory, setEditProdCategory] = React.useState('');
  const [editProdBrand, setEditProdBrand] = React.useState('');
  const [editProdDesc, setEditProdDesc] = React.useState('');
  const [editProdStatus, setEditProdStatus] = React.useState<'active' | 'inactive'>('active');
  const [editProdFulfillment, setEditProdFulfillment] = React.useState('automatic');
  const [editProdCaps, setEditProdCaps] = React.useState<ProductCapability[]>([]);
  const [savingProduct, setSavingProduct] = React.useState(false);

  // Delete Product State
  const [deletingProduct, setDeletingProduct] = React.useState<Product | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = React.useState(false);

  // Edit Category Modal & Category Plans State
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = React.useState('');
  const [editCategoryDesc, setEditCategoryDesc] = React.useState('');
  const [savingCategory, setSavingCategory] = React.useState(false);
  const [categoryPlans, setCategoryPlans] = React.useState<Plan[]>([]);
  const [categoryProducts, setCategoryProducts] = React.useState<Product[]>([]);
  const [loadingCatPlans, setLoadingCatPlans] = React.useState(false);

  // Inline edit plan price state inside category modal
  const [editingPlanPriceId, setEditingPlanPriceId] = React.useState<string | null>(null);
  const [inlinePriceValue, setInlinePriceValue] = React.useState<number>(0);
  const [savingPlanPrice, setSavingPlanPrice] = React.useState(false);

  // Add plan to category form state
  const [catPlanProductId, setCatPlanProductId] = React.useState('');
  const [catPlanName, setCatPlanName] = React.useState('');
  const [catPlanDuration, setCatPlanDuration] = React.useState(1);
  const [catPlanUnit, setCatPlanUnit] = React.useState<'days' | 'months' | 'years'>('months');
  const [catPlanPrice, setCatPlanPrice] = React.useState(9.99);
  const [catPlanCost, setCatPlanCost] = React.useState(3.5);
  const [creatingCatPlan, setCreatingCatPlan] = React.useState(false);
  const [quickProdName, setQuickProdName] = React.useState('');

  // Delete Category Confirmation State (Option A vs Option B)
  const [deletingCategory, setDeletingCategory] = React.useState<Category | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = React.useState(false);

  // Manage Categories Drawer/Modal
  const [showManageCategories, setShowManageCategories] = React.useState(false);

  // New Product Modal
  const [showNewProduct, setShowNewProduct] = React.useState(false);
  const [prodName, setProdName] = React.useState('');
  const [prodCategory, setProdCategory] = React.useState('');
  const [prodBrand, setProdBrand] = React.useState('');
  const [prodDesc, setProdDesc] = React.useState('');
  const [prodCaps, setProdCaps] = React.useState<ProductCapability[]>([
    'subscription',
    'service_account',
    'profiles',
    'automatic_fulfillment'
  ]);

  // Manage Plans Modal (Per-Product)
  const [activePlanProduct, setActivePlanProduct] = React.useState<Product | null>(null);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [newPlanName, setNewPlanName] = React.useState('');
  const [newPlanDuration, setNewPlanDuration] = React.useState(1);
  const [newPlanUnit, setNewPlanUnit] = React.useState<'days' | 'months' | 'years'>('months');
  const [newPlanPrice, setNewPlanPrice] = React.useState(9.99);
  const [newPlanCost, setNewPlanCost] = React.useState(3.5);

  // Editing plan state inside Manage Plans modal
  const [editingPlanId, setEditingPlanId] = React.useState<string | null>(null);
  const [editPlanName, setEditPlanName] = React.useState('');
  const [editPlanDuration, setEditPlanDuration] = React.useState(1);
  const [editPlanUnit, setEditPlanUnit] = React.useState<'days' | 'months' | 'years'>('months');
  const [editPlanPrice, setEditPlanPrice] = React.useState(9.99);
  const [editPlanCost, setEditPlanCost] = React.useState(3.5);
  const [savingPlan, setSavingPlan] = React.useState(false);

  // New Category Modal
  const [showNewCategory, setShowNewCategory] = React.useState(false);
  const [catName, setCatName] = React.useState('');
  const [catDesc, setCatDesc] = React.useState('');
  const [isBulkCategory, setIsBulkCategory] = React.useState(false);
  const [bulkCatNames, setBulkCatNames] = React.useState('');
  const [submittingCategory, setSubmittingCategory] = React.useState(false);

  // Close dropdown menu and modals when clicking anywhere or pressing Escape
  React.useEffect(() => {
    const handleGlobalClick = () => {
      setOpenProductMenuId(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenProductMenuId(null);
        setShowNewProduct(false);
        setEditingProduct(null);
        setDeletingProduct(null);
        setActivePlanProduct(null);
        setEditingPlanId(null);
        setShowNewCategory(false);
        setIsBulkCategory(false);
        setBulkCatNames('');
        setShowManageCategories(false);
        setEditingCategory(null);
        setDeletingCategory(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3500);
  };

  React.useEffect(() => {
    loadData(true);
  }, [selectedCategory]);

  const loadData = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      const [cRes, pRes] = await Promise.all([
        api.getCategories(),
        api.getProducts(selectedCategory !== 'all' ? { category_id: selectedCategory } : undefined)
      ]);
      setCategories(cRes.categories);
      setProducts(pRes.products);
      if (cRes.categories.length > 0 && !prodCategory) {
        setProdCategory(cRes.categories[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  };

  const toggleCap = (cap: ProductCapability) => {
    if (prodCaps.includes(cap)) {
      setProdCaps(prodCaps.filter((c) => c !== cap));
    } else {
      setProdCaps([...prodCaps, cap]);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodCategory) return;
    try {
      await api.createProduct({
        name: prodName,
        category_id: prodCategory,
        brand: prodBrand,
        description: prodDesc,
        capabilities: prodCaps,
        fulfillment_type: prodCaps.includes('service_account') ? 'service_account' : prodCaps.includes('license_key') ? 'license_key' : 'merch_mockup'
      });
      setShowNewProduct(false);
      setProdName('');
      setProdBrand('');
      setProdDesc('');
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      loadData(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenPlans = async (product: Product) => {
    setActivePlanProduct(product);
    setEditingPlanId(null);
    try {
      const res = await api.getPlans(product.id);
      setPlans(res.plans);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlanProduct || !newPlanName) return;
    try {
      await api.createPlan({
        product_id: activePlanProduct.id,
        name: newPlanName,
        duration: Number(newPlanDuration),
        duration_unit: newPlanUnit,
        price: Number(newPlanPrice),
        cost: Number(newPlanCost)
      });
      const res = await api.getPlans(activePlanProduct.id);
      setPlans(res.plans);
      setNewPlanName('');
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      loadData(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Delete this plan?')) return;
    try {
      await api.deletePlan(id);
      if (editingPlanId === id) {
        setEditingPlanId(null);
      }
      if (activePlanProduct) {
        const res = await api.getPlans(activePlanProduct.id);
        setPlans(res.plans);
      }
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      loadData(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStartEditPlan = (pl: Plan) => {
    setEditingPlanId(pl.id);
    setEditPlanName(pl.name);
    setEditPlanDuration(pl.duration);
    setEditPlanUnit(pl.duration_unit as any);
    setEditPlanPrice(pl.price);
    setEditPlanCost(pl.cost);
  };

  const handleSaveEditPlan = async (id: string) => {
    if (!editPlanName.trim()) {
      alert('Plan name is required.');
      return;
    }
    setSavingPlan(true);
    try {
      await api.updatePlan(id, {
        name: editPlanName.trim(),
        duration: Number(editPlanDuration),
        duration_unit: editPlanUnit,
        price: Number(editPlanPrice),
        cost: Number(editPlanCost)
      });
      showNotification('Plan updated successfully.');
      setEditingPlanId(null);
      if (activePlanProduct) {
        const res = await api.getPlans(activePlanProduct.id);
        setPlans(res.plans);
      }
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      loadData(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBulkCategory) {
      const lines = bulkCatNames
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) return;
      setSubmittingCategory(true);
      try {
        let createdCount = 0;
        for (const name of lines) {
          try {
            await api.createCategory({ name });
            createdCount++;
          } catch (err: any) {
            console.warn(`Failed to create category "${name}":`, err?.message || err);
          }
        }
        setShowNewCategory(false);
        setIsBulkCategory(false);
        setBulkCatNames('');
        showNotification(`Successfully created ${createdCount} categories.`);
        window.dispatchEvent(new CustomEvent('app:data-mutated'));
        loadData(false);
      } catch (err: any) {
        alert(err.message || 'Failed to create categories.');
      } finally {
        setSubmittingCategory(false);
      }
      return;
    }

    if (!catName.trim()) return;
    setSubmittingCategory(true);
    try {
      await api.createCategory({ name: catName.trim(), description: catDesc });
      setShowNewCategory(false);
      setCatName('');
      setCatDesc('');
      showNotification('Category created and saved to database.');
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      loadData(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingCategory(false);
    }
  };

  // Open Edit Category Modal with its associated plans & products from DB
  const handleOpenEditCategory = async (cat: Category) => {
    setEditingCategory(cat);
    setEditCategoryName(cat.name);
    setEditCategoryDesc(cat.description || '');
    setEditingPlanPriceId(null);
    setLoadingCatPlans(true);
    try {
      const [pRes, plRes] = await Promise.all([
        api.getProducts({ category_id: cat.id }),
        api.getCategoryPlans(cat.id)
      ]);
      setCategoryProducts(pRes.products);
      setCategoryPlans(plRes.plans);
      if (pRes.products.length > 0) {
        setCatPlanProductId(pRes.products[0].id);
      } else {
        setCatPlanProductId('');
      }
    } catch (err: any) {
      console.error('Error fetching category plans:', err);
    } finally {
      setLoadingCatPlans(false);
    }
  };

  // Save Category Name & Details to DB
  const handleSaveCategoryDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      await api.updateCategory(editingCategory.id, {
        name: editCategoryName.trim(),
        description: editCategoryDesc.trim()
      });
      setEditingCategory({
        ...editingCategory,
        name: editCategoryName.trim(),
        description: editCategoryDesc.trim()
      });
      showNotification('Category details saved to database.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update category.');
    } finally {
      setSavingCategory(false);
    }
  };

  // Add a new plan attached to this category directly from modal
  const handleCreatePlanForCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !catPlanName.trim()) return;

    let targetProductId = catPlanProductId;
    if (!targetProductId && categoryProducts.length > 0) {
      targetProductId = categoryProducts[0].id;
    }

    setCreatingCatPlan(true);
    try {
      // If no product exists yet in this category, create a baseline product
      if (!targetProductId) {
        const prodRes = await api.createProduct({
          name: quickProdName.trim() || `${editingCategory.name} Standard`,
          category_id: editingCategory.id,
          brand: editingCategory.name,
          description: 'Catalog product for category plans',
          capabilities: ['subscription', 'manual_fulfillment'],
          fulfillment_type: 'automatic'
        });
        targetProductId = prodRes.id;
        const pRes = await api.getProducts({ category_id: editingCategory.id });
        setCategoryProducts(pRes.products);
        setCatPlanProductId(targetProductId);
      }

      await api.createPlan({
        product_id: targetProductId,
        name: catPlanName.trim(),
        duration: Number(catPlanDuration),
        duration_unit: catPlanUnit,
        price: Number(catPlanPrice),
        cost: Number(catPlanCost)
      });

      const plRes = await api.getCategoryPlans(editingCategory.id);
      setCategoryPlans(plRes.plans);
      setCatPlanName('');
      showNotification('New subscription plan added and saved to database.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create plan.');
    } finally {
      setCreatingCatPlan(false);
    }
  };

  // Save edited plan price directly to DB
  const handleSavePlanPrice = async (planId: string) => {
    if (inlinePriceValue === undefined || inlinePriceValue < 0) return;
    setSavingPlanPrice(true);
    try {
      await api.updatePlan(planId, { price: Number(inlinePriceValue) });
      setEditingPlanPriceId(null);
      if (editingCategory) {
        const plRes = await api.getCategoryPlans(editingCategory.id);
        setCategoryPlans(plRes.plans);
      }
      showNotification('Plan price updated in database.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update plan price.');
    } finally {
      setSavingPlanPrice(false);
    }
  };

  // Delete plan directly from category modal
  const handleDeletePlanFromCategory = async (planId: string, planName: string) => {
    if (!confirm(`Are you sure you want to delete plan "${planName}"? This action is saved to the database immediately.`)) return;
    try {
      await api.deletePlan(planId);
      if (editingCategory) {
        const plRes = await api.getCategoryPlans(editingCategory.id);
        setCategoryPlans(plRes.plans);
      }
      showNotification(`Plan "${planName}" deleted from database.`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete plan.');
    }
  };

  // Open Delete Category confirmation modal
  const handleOpenDeleteCategory = (cat: Category) => {
    setDeletingCategory(cat);
  };

  // Execute safe category deletion (Option A or Option B)
  const handleConfirmDeleteCategory = async (mode: 'move_to_general' | 'unassign_plans') => {
    if (!deletingCategory) return;
    setIsDeletingCategory(true);
    try {
      const res = await api.deleteCategory(deletingCategory.id, mode);
      showNotification(res.message || 'Category deleted successfully.');
      if (selectedCategory === deletingCategory.id) {
        setSelectedCategory('all');
      }
      setDeletingCategory(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category.');
    } finally {
      setIsDeletingCategory(false);
    }
  };

  // Open Edit Product Modal
  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setEditProdName(prod.name);
    setEditProdCategory(prod.category_id);
    setEditProdBrand(prod.brand || '');
    setEditProdDesc(prod.description || '');
    setEditProdStatus(prod.status || 'active');
    setEditProdFulfillment(prod.fulfillment_type || 'automatic');
    setEditProdCaps(prod.capabilities || ['subscription', 'automatic_fulfillment']);
  };

  // Toggle Edit Product Capability
  const toggleEditProdCap = (cap: ProductCapability) => {
    if (editProdCaps.includes(cap)) {
      setEditProdCaps(editProdCaps.filter((c) => c !== cap));
    } else {
      setEditProdCaps([...editProdCaps, cap]);
    }
  };

  // Save Edited Product to DB
  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editProdName.trim() || !editProdCategory) return;
    setSavingProduct(true);
    try {
      await api.updateProduct(editingProduct.id, {
        name: editProdName.trim(),
        category_id: editProdCategory,
        brand: editProdBrand.trim() || null,
        description: editProdDesc.trim() || null,
        status: editProdStatus,
        fulfillment_type: editProdFulfillment,
        capabilities: editProdCaps
      });
      showNotification('Product details updated successfully.');
      setEditingProduct(null);
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      loadData(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update product.');
    } finally {
      setSavingProduct(false);
    }
  };

  // Confirm and execute product deletion
  const handleConfirmDeleteProduct = async () => {
    if (!deletingProduct) return;
    setIsDeletingProduct(true);
    try {
      const res = await api.deleteProduct(deletingProduct.id);
      showNotification(res.message || 'Product removed successfully.');
      setDeletingProduct(null);
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      loadData(false);
    } catch (err: any) {
      alert(err.message || 'Failed to delete product.');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Products & Category Catalog</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure capability profiles, licensing models, and category subscription plans.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowManageCategories(true)}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
            title="View and manage all categories"
          >
            <FolderEdit size={15} />
            <span>Manage Categories</span>
          </button>
          <button
            onClick={() => setShowNewCategory(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
          >
            <Tag size={15} />
            <span>New Category</span>
          </button>
          <button
            onClick={() => setShowNewProduct(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-blue-600/25 transition"
          >
            <Plus size={16} />
            <span>New Product</span>
          </button>
        </div>
      </div>

      {/* Categories Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-semibold transition shrink-0 ${
            selectedCategory === 'all'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Products ({products.length})
        </button>
        {categories.map((c) => {
          const isSelected = selectedCategory === c.id;

          return (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{c.name}</span>
              <span className={isSelected ? 'text-slate-300' : 'text-slate-400'}>
                ({c.product_count || 0})
              </span>
            </button>
          );
        })}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading catalog...</div>
      ) : products.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
          No products found in this category. Click "New Product" above to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-base shrink-0">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                      <p className="text-[11px] text-slate-400">{p.brand || 'Digital Asset'} • {p.category_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 relative">
                    <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                      p.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {p.status === 'active' ? 'Active' : 'Inactive'}
                    </span>

                    {/* 3-Dots Action Trigger Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        productMenuTriggerRef.current = e.currentTarget;
                        setOpenProductMenuId(openProductMenuId === p.id ? null : p.id);
                      }}
                      className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      title="Product actions"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-slate-500 mt-3 line-clamp-2">{p.description}</p>
                )}

                {/* Capabilities Badges */}
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                  {p.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                    >
                      {cap.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom stats & Manage Plans button */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">{p.plan_count || 0}</span> plans configured
                </div>
                <button
                  onClick={() => handleOpenPlans(p)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition"
                >
                  Manage Plans
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3-Dots Product Action Menu Portal (Rendered outside grid to prevent clipping and scrolling) */}
      {(() => {
        const activeProduct = products.find((p) => p.id === openProductMenuId);
        if (!activeProduct) return null;

        return (
          <PortalDropdown
            isOpen={Boolean(activeProduct)}
            onClose={() => setOpenProductMenuId(null)}
            triggerRef={productMenuTriggerRef}
            width={160}
          >
            <button
              type="button"
              onClick={() => {
                setOpenProductMenuId(null);
                handleOpenEditProduct(activeProduct);
              }}
              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
            >
              <Edit2 size={13} className="text-blue-600 shrink-0" />
              <span>Edit</span>
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              onClick={() => {
                setOpenProductMenuId(null);
                setDeletingProduct(activeProduct);
              }}
              className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition"
            >
              <Trash2 size={13} className="text-rose-600 shrink-0" />
              <span>Delete</span>
            </button>
          </PortalDropdown>
        );
      })()}

      {/* Modal: New Product */}
      {showNewProduct && (
        <div
          onClick={() => setShowNewProduct(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5 my-8"
          >
            <h3 className="text-base font-bold text-slate-900">Add New Product</h3>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Canva Pro Edu"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Category *</label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Brand / Provider</label>
                <input
                  type="text"
                  placeholder="e.g. OpenAI, Netflix, Adobe"
                  value={prodBrand}
                  onChange={(e) => setProdBrand(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Capabilities (Check all that apply)</label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  {[
                    { id: 'subscription', label: 'Subscription Term (Expiring)' },
                    { id: 'service_account', label: 'Service Account (Login/Password)' },
                    { id: 'profiles', label: 'Shared Profiles (PIN Protection)' },
                    { id: 'license_key', label: 'Serial / License Key Bank' },
                    { id: 'merch_mockup', label: 'On-Demand Merch & Mockups' },
                    { id: 'automatic_fulfillment', label: 'Auto Atomic Fulfillment' }
                  ].map((cap) => (
                    <label key={cap.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prodCaps.includes(cap.id as any)}
                        onChange={() => toggleCap(cap.id as any)}
                        className="accent-blue-600 rounded"
                      />
                      <span>{cap.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewProduct(false)}
                  className="px-4 py-2 border rounded-xl text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500"
                >
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manage Plans */}
      {activePlanProduct && (
        <div
          onClick={() => setActivePlanProduct(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5 my-8"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Plans for {activePlanProduct.name}
                </h3>
                <p className="text-xs text-slate-400">Manage duration, retail pricing, and supplier costs.</p>
              </div>
              <button
                onClick={() => setActivePlanProduct(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            {/* List existing plans */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto">
              {plans.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                  No plans configured for this product yet. Add one below.
                </div>
              ) : (
                plans.map((pl) => (
                  editingPlanId === pl.id ? (
                    <div
                      key={pl.id}
                      className="p-3.5 rounded-2xl border-2 border-blue-500 bg-white shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Edit2 size={13} className="text-blue-600" />
                          <span>Edit Plan</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {pl.id}</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-semibold text-slate-700 block">Plan Name *</label>
                          <input
                            type="text"
                            value={editPlanName}
                            onChange={(e) => setEditPlanName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-700 block">Duration *</label>
                          <input
                            type="number"
                            min="1"
                            value={editPlanDuration}
                            onChange={(e) => setEditPlanDuration(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-700 block">Unit *</label>
                          <select
                            value={editPlanUnit}
                            onChange={(e) => setEditPlanUnit(e.target.value as any)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                          >
                            <option value="days">Days</option>
                            <option value="months">Months</option>
                            <option value="years">Years</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-700 block">Retail Price ($) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editPlanPrice}
                            onChange={(e) => setEditPlanPrice(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-700 block">Unit Cost ($) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editPlanCost}
                            onChange={(e) => setEditPlanCost(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                            required
                          />
                        </div>
                        <div className="col-span-2 flex items-end justify-end gap-2 pt-1">
                          <button
                            type="button"
                            disabled={savingPlan}
                            onClick={() => setEditingPlanId(null)}
                            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-slate-50 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={savingPlan}
                            onClick={() => handleSaveEditPlan(pl.id)}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Check size={13} />
                            <span>{savingPlan ? 'Saving...' : 'Save Plan'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={pl.id}
                      className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs hover:border-slate-300 transition"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{pl.name}</span>
                        <span className="text-slate-500 ml-2">
                          ({pl.duration} {pl.duration_unit})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-emerald-700">{formatMoney(pl.price, 'USD')}</span>
                        <span className="text-[10px] text-slate-400">(Cost: {formatMoney(pl.cost, 'USD')})</span>
                        <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                          {/* Edit Plan Button */}
                          <button
                            type="button"
                            onClick={() => handleStartEditPlan(pl)}
                            title="Edit plan"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Edit2 size={13} />
                          </button>
                          {/* Delete Plan Button */}
                          <button
                            type="button"
                            onClick={() => handleDeletePlan(pl.id)}
                            title="Delete plan"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                ))
              )}
            </div>

            {/* Form to add new plan with labeled inputs */}
            <form onSubmit={handleCreatePlan} className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <Plus size={13} className="text-blue-600" />
                  <span>Add New Pricing Plan</span>
                </p>
                <span className="text-[10px] text-blue-600/70 font-medium">Instantly saved to database</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 block">Plan Name *</label>
                  <input
                    type="text"
                    placeholder="Plan Name (e.g. 1 Month Pro)"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 block">Duration *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={newPlanDuration}
                    onChange={(e) => setNewPlanDuration(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 block">Unit *</label>
                  <select
                    value={newPlanUnit}
                    onChange={(e) => setNewPlanUnit(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="days">Days</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 block">Retail Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="9.99"
                    value={newPlanPrice}
                    onChange={(e) => setNewPlanPrice(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 block">Unit Cost ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="3.50"
                    value={newPlanCost}
                    onChange={(e) => setNewPlanCost(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="col-span-2 flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold py-2 shadow-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>Add Plan</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Category */}
      {showNewCategory && (
        <div
          onClick={() => {
            setShowNewCategory(false);
            setIsBulkCategory(false);
            setBulkCatNames('');
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-900">
              {isBulkCategory ? 'Add Bulk Categories' : 'Add New Category'}
            </h3>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              {isBulkCategory ? (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Category Names (one per line) *
                  </label>
                  <textarea
                    required
                    rows={6}
                    placeholder={'Streaming Services\nSoftware & Tools\nVPN & Proxies'}
                    value={bulkCatNames}
                    onChange={(e) => setBulkCatNames(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-hidden font-mono"
                  />
                  <div className="mt-1.5">
                    <a
                      href="#single-category"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsBulkCategory(false);
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline cursor-pointer inline-flex items-center gap-1 font-medium"
                    >
                      ← Back to single category
                    </a>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Category Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Streaming Services"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-hidden"
                  />
                  <div className="mt-1.5">
                    <a
                      href="#bulk-categories"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsBulkCategory(true);
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline cursor-pointer inline-flex items-center gap-1 font-medium"
                    >
                      Add bulk categories (each category in line)
                    </a>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={submittingCategory}
                  onClick={() => {
                    setShowNewCategory(false);
                    setIsBulkCategory(false);
                    setBulkCatNames('');
                  }}
                  className="px-3 py-1.5 text-xs border rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCategory}
                  className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 shadow-xs disabled:opacity-50"
                >
                  {submittingCategory ? 'Saving...' : isBulkCategory ? 'Save Categories' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Category & Manage Category Subscription Plans */}
      {editingCategory && (
        <div
          onClick={() => setEditingCategory(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-6 my-8 max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 size={16} className="text-blue-600" />
                  <span>Edit Category: {editingCategory.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update category details and configure attached subscription plans directly in database.
                </p>
              </div>
              <button
                onClick={() => setEditingCategory(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Section 1: Change Category Name Form */}
            <form onSubmit={handleSaveCategoryDetails} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Category Name & Information
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">ID: {editingCategory.id}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Category Name *</label>
                  <input
                    type="text"
                    required
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    placeholder="Category Name"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={editCategoryDesc}
                    onChange={(e) => setEditCategoryDesc(e.target.value)}
                    placeholder="Brief description..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                >
                  <Check size={14} />
                  <span>{savingCategory ? 'Saving Changes...' : 'Save Category Name'}</span>
                </button>
              </div>
            </form>

            {/* Section 2: Subscription Plans Attached to this Category */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={14} className="text-blue-600" />
                    Subscription Plans Attached to this Category ({categoryPlans.length})
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Live plans across all products in this category. Edit prices or delete specific plans instantly.
                  </p>
                </div>
              </div>

              {/* Plans List */}
              {loadingCatPlans ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                  Loading subscription plans from database...
                </div>
              ) : categoryPlans.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                  No subscription plans attached to products in this category yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {categoryPlans.map((pl) => {
                    const isEditingPrice = editingPlanPriceId === pl.id;

                    return (
                      <div
                        key={pl.id}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 flex items-center justify-between text-xs transition"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{pl.name}</span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-[10px]">
                              {pl.duration} {pl.duration_unit}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Product: <span className="font-semibold text-slate-600">{pl.product_name || 'Standard'}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Price Display or Inline Edit */}
                          {isEditingPrice ? (
                            <div className="flex items-center gap-1 bg-white border border-blue-300 rounded-xl p-1 shadow-xs">
                              <span className="text-slate-400 text-xs pl-1">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                autoFocus
                                value={inlinePriceValue}
                                onChange={(e) => setInlinePriceValue(Number(e.target.value))}
                                className="w-16 text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden"
                              />
                              <button
                                type="button"
                                disabled={savingPlanPrice}
                                onClick={() => handleSavePlanPrice(pl.id)}
                                title="Save price to DB"
                                className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPlanPriceId(null)}
                                title="Cancel"
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-emerald-700 text-xs">{formatMoney(pl.price, 'USD')}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPlanPriceId(pl.id);
                                  setInlinePriceValue(pl.price);
                                }}
                                title="Edit plan price"
                                className="p-1 text-slate-400 hover:text-blue-600 rounded-md transition"
                              >
                                <Edit2 size={12} />
                              </button>
                            </div>
                          )}

                          <span className="text-[10px] text-slate-400">(Cost: ${pl.cost.toFixed(2)})</span>

                          {/* Delete Plan Button */}
                          <button
                            type="button"
                            onClick={() => handleDeletePlanFromCategory(pl.id, pl.name)}
                            title="Delete plan"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Form to Add New Plan Attached to this Category */}
              <form
                onSubmit={handleCreatePlanForCategory}
                className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/80 space-y-3 pt-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Plus size={13} className="text-blue-600" />
                    <span>Add New Plan to this Category</span>
                  </p>
                  <span className="text-[10px] text-blue-600/70 font-medium">Instantly saved to database</span>
                </div>

                {/* Target Product Selector if multiple products exist in this category */}
                {categoryProducts.length > 1 && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Target Product *</label>
                    <select
                      value={catPlanProductId}
                      onChange={(e) => setCatPlanProductId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden"
                    >
                      {categoryProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.brand || 'Digital'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {categoryProducts.length === 0 && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Initial Product Name (auto-creates product for plans) *
                    </label>
                    <input
                      type="text"
                      placeholder={`e.g. ${editingCategory.name} Standard`}
                      value={quickProdName}
                      onChange={(e) => setQuickProdName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Plan Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. 1-Month, 3-Month, Annual"
                      value={catPlanName}
                      onChange={(e) => setCatPlanName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Duration *</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={catPlanDuration}
                      onChange={(e) => setCatPlanDuration(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Unit *</label>
                    <select
                      value={catPlanUnit}
                      onChange={(e) => setCatPlanUnit(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs focus:outline-hidden"
                    >
                      <option value="days">Days</option>
                      <option value="months">Months</option>
                      <option value="years">Years</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Retail Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="9.99"
                      value={catPlanPrice}
                      onChange={(e) => setCatPlanPrice(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Unit Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="3.50"
                      value={catPlanCost}
                      onChange={(e) => setCatPlanCost(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-hidden"
                    />
                  </div>

                  <div className="col-span-2 flex items-end">
                    <button
                      type="submit"
                      disabled={creatingCatPlan}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold py-2 shadow-xs transition disabled:opacity-50"
                    >
                      {creatingCatPlan ? 'Adding Plan...' : 'Add Plan to Category'}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="px-5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Category Safe Confirmation (Option A vs Option B) */}
      {deletingCategory && (
        <div
          onClick={() => setDeletingCategory(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5"
          >
            {/* Header */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Category: {deletingCategory.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  This category currently contains <strong className="text-slate-800">{deletingCategory.product_count || 0} product(s)</strong> and their subscription plans in the database.
                </p>
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-800">
              Please select one of the following safe options to proceed:
            </p>

            {/* Safe Choices */}
            <div className="space-y-3">
              {/* Option A */}
              <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50/70 transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] uppercase tracking-wide">
                    Option A (Recommended)
                  </span>
                  <span className="text-[11px] text-blue-700 font-medium">Safe Reassignment</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900">
                  Move all products to "General" category
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  All products and subscription plans currently in "{deletingCategory.name}" will be safely reassigned to the "General" category. No products, plans, or order records will be lost.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={isDeletingCategory}
                    onClick={() => handleConfirmDeleteCategory('move_to_general')}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
                  >
                    {isDeletingCategory ? 'Processing...' : 'Move to General & Delete Category'}
                  </button>
                </div>
              </div>

              {/* Option B */}
              <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/30 hover:bg-rose-50/60 transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] uppercase tracking-wide">
                    Option B
                  </span>
                  <span className="text-[11px] text-rose-700 font-medium">Clean Removal</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900">
                  Delete the category and unassign its plans
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Deletes the category and unassigns or detaches its subscription plans. Unused products/plans are removed, while any products referenced by customer orders are safely archived to preserve database integrity.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={isDeletingCategory}
                    onClick={() => handleConfirmDeleteCategory('unassign_plans')}
                    className="w-full py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
                  >
                    {isDeletingCategory ? 'Processing...' : 'Delete Category & Unassign Plans'}
                  </button>
                </div>
              </div>
            </div>

            {/* Cancel Button */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={isDeletingCategory}
                onClick={() => setDeletingCategory(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Product */}
      {editingProduct && (
        <div
          onClick={() => setEditingProduct(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5 my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 size={16} className="text-blue-600" />
                  <span>Edit Product</span>
                </h3>
                <p className="text-xs text-slate-400">Update product specifications, category mapping, and fulfillment.</p>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={editProdName}
                    onChange={(e) => setEditProdName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Category *</label>
                  <select
                    value={editProdCategory}
                    onChange={(e) => setEditProdCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Brand / Provider</label>
                  <input
                    type="text"
                    placeholder="e.g. OpenAI, Netflix, Adobe"
                    value={editProdBrand}
                    onChange={(e) => setEditProdBrand(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Status</label>
                  <select
                    value={editProdStatus}
                    onChange={(e) => setEditProdStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="active">Active (Available for Orders)</option>
                    <option value="inactive">Inactive (Hidden from Ordering)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={editProdDesc}
                  onChange={(e) => setEditProdDesc(e.target.value)}
                  placeholder="Product description and details..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Fulfillment Type</label>
                <select
                  value={editProdFulfillment}
                  onChange={(e) => setEditProdFulfillment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="automatic">Automatic Fulfillment</option>
                  <option value="service_account">Service Account Profile</option>
                  <option value="license_key">License Key Bank</option>
                  <option value="manual">Manual Agent Delivery</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Capabilities (Check all that apply)</label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  {[
                    { id: 'subscription', label: 'Subscription Term (Expiring)' },
                    { id: 'service_account', label: 'Service Account (Login/Password)' },
                    { id: 'profiles', label: 'Shared Profiles (PIN Protection)' },
                    { id: 'license_key', label: 'Serial / License Key Bank' },
                    { id: 'merch_mockup', label: 'On-Demand Merch & Mockups' },
                    { id: 'automatic_fulfillment', label: 'Auto Atomic Fulfillment' }
                  ].map((cap) => (
                    <label key={cap.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editProdCaps.includes(cap.id as any)}
                        onChange={() => toggleEditProdCap(cap.id as any)}
                        className="accent-blue-600 rounded"
                      />
                      <span>{cap.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  disabled={savingProduct}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 shadow-md shadow-blue-600/20 transition disabled:opacity-50"
                >
                  {savingProduct ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Product Confirmation */}
      {deletingProduct && (
        <div
          onClick={() => setDeletingProduct(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Product</h3>
                <p className="text-xs text-slate-400">Confirm catalog product removal</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-2 text-xs">
              <p className="font-semibold text-slate-800">
                Are you sure you want to delete <span className="text-rose-700 font-bold">"{deletingProduct.name}"</span>?
              </p>
              <p className="text-slate-600 leading-relaxed">
                This action will delete the product, its unassigned subscription plans, and associated credentials from the catalog.
              </p>
              <div className="pt-1 text-[11px] text-slate-500 flex items-center gap-2">
                <span>Plans configured: <strong className="text-slate-800">{deletingProduct.plan_count || 0}</strong></span>
                <span>•</span>
                <span>Category: <strong className="text-slate-800">{deletingProduct.category_name}</strong></span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingProduct}
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingProduct}
                onClick={handleConfirmDeleteProduct}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-rose-600/20 transition disabled:opacity-50"
              >
                {isDeletingProduct ? 'Deleting...' : 'Delete Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Manage All Categories */}
      {showManageCategories && (
        <div
          onClick={() => setShowManageCategories(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FolderEdit size={16} className="text-blue-600" />
                  <span>Category Directory ({categories.length})</span>
                </h3>
                <p className="text-xs text-slate-400">View and manage all category structures and plans.</p>
              </div>
              <button
                onClick={() => setShowManageCategories(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs hover:border-slate-300 transition"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 text-xs">{cat.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {cat.product_count || 0} Products • Slug: <span className="font-mono">{cat.slug}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowManageCategories(false);
                        handleOpenEditCategory(cat);
                      }}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-semibold flex items-center gap-1.5 transition"
                    >
                      <Edit2 size={12} />
                      <span>Edit & Plans</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowManageCategories(false);
                        handleOpenDeleteCategory(cat);
                      }}
                      className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-semibold flex items-center gap-1.5 transition"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowManageCategories(false);
                  setShowNewCategory(true);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Plus size={14} />
                <span>New Category</span>
              </button>

              <button
                type="button"
                onClick={() => setShowManageCategories(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-in slide-in-from-bottom-3 duration-150 border border-slate-700">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
