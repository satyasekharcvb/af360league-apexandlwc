import { LightningElement, api, track } from 'lwc';
import promotionStateManager from 'c/promotionStateManager';
import getRetailStores from '@salesforce/apex/PromotionCreatorCtrl.getRetailStores';

export default class PromotionWizardStep3 extends LightningElement {
    promotionState = promotionStateManager;

    @api recordId; // Account Id passed from parent wizard

    @track stores = [];
    @track selectedStoreIds = new Set();
    
    isLoading = true;
    error = null;

    connectedCallback() {
        this.restoreSelectionsFromState();
        this.loadStores();
    }

    restoreSelectionsFromState() {
        const stateStores = this.promotionState?.value?.chosenStores || [];
        stateStores.forEach(store => {
            this.selectedStoreIds.add(store.storeId);
        });
    }

    async loadStores() {
        this.isLoading = true;
        this.error = null;

        try {
            const result = await getRetailStores({
                accountId: this.recordId
            });

            this.stores = result.map(store => ({
                id: store.Id,
                name: store.Name,
                locationGroup: store.RetailLocationGroup?.Name || 'N/A',
                isSelected: this.selectedStoreIds.has(store.Id)
            }));
        } catch (err) {
            this.error = err.body?.message || 'Failed to load stores';
            console.error('Error loading stores:', err);
        } finally {
            this.isLoading = false;
        }
    }

    handleCheckboxChange(event) {
        const storeId = event.target.dataset.id;
        const isChecked = event.target.checked;
        const store = this.stores.find(s => s.id === storeId);

        if (isChecked) {
            this.selectedStoreIds.add(storeId);
        } else {
            this.selectedStoreIds.delete(storeId);
        }

        // Update the stores array to reflect selection change
        this.stores = this.stores.map(s => {
            if (s.id === storeId) {
                return { ...s, isSelected: isChecked };
            }
            return s;
        });
    }

    handleSelectAll(event) {
        const isChecked = event.target.checked;
        
        if (isChecked) {
            this.stores.forEach(store => {
                this.selectedStoreIds.add(store.id);
            });
        } else {
            this.selectedStoreIds.clear();
        }

        this.stores = this.stores.map(s => ({
            ...s,
            isSelected: isChecked
        }));
    }

    get hasStores() {
        return this.stores && this.stores.length > 0;
    }

    get noStores() {
        return !this.hasStores;
    }

    get notLoading() {
        return !this.isLoading;
    }

    get selectedCount() {
        return this.selectedStoreIds.size;
    }

    get totalCount() {
        return this.stores.length;
    }

    get hasSelectedStores() {
        return this.selectedCount > 0;
    }

    get allSelected() {
        return this.stores.length > 0 && this.selectedStoreIds.size === this.stores.length;
    }

    get someSelected() {
        return this.selectedStoreIds.size > 0 && this.selectedStoreIds.size < this.stores.length;
    }

    get selectedStoresList() {
        return this.stores.filter(s => this.selectedStoreIds.has(s.id));
    }

    // Get summary data from state for display
    get promotionName() {
        return this.promotionState?.value?.promotionName || 'Untitled Promotion';
    }

    get selectedProducts() {
        return this.promotionState?.value?.chosenProducts || [];
    }

    get hasSelectedProducts() {
        return this.selectedProducts.length > 0;
    }

    @api
    allValid() {
        console.log('Step 3 validation called, selected stores:', this.selectedStoreIds.size);
        // Check if at least one store is selected
        if (this.selectedStoreIds.size === 0) {
            this.error = 'Please select at least one store.';
            console.log('Validation failed: no stores selected');
            return false;
        }

        // Save selections to state
        const storesArray = this.stores
            .filter(s => this.selectedStoreIds.has(s.id))
            .map(s => ({
                storeId: s.id,
                storeName: s.name,
                locationGroup: s.locationGroup
            }));
        
        console.log('Updating stores in state:', storesArray);
        // Add more robust error checking for state access
        try {
            if (this.promotionState && this.promotionState.value) {
                if (typeof this.promotionState.value.updateStores === 'function') {
                    this.promotionState.value.updateStores(storesArray);
                    console.log('Stores updated successfully');
                } else {
                    console.error('updateStores is not a function:', this.promotionState.value.updateStores);
                }
            } else {
                console.error('promotionState or promotionState.value is undefined:', this.promotionState);
            }
        } catch (error) {
            console.error('Error updating stores in state:', error);
        }
        
        this.error = null;
        console.log('Validation passed for step 3');
        return true;
    }

    @api
    getPromotionData() {
        return {
            promotionName: this.promotionName,
            products: this.selectedProducts,
            stores: this.selectedStoresList.map(s => ({
                storeId: s.id,
                storeName: s.name,
                locationGroup: s.locationGroup
            }))
        };
    }
}
