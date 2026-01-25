import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from 'lightning/actions';
import savePromotion from '@salesforce/apex/PromotionCreatorCtrl.savePromotion';

export default class PromotionCreationWizard extends NavigationMixin(LightningElement) {
    @api recordId; // Account Id from record page context

    currentStep = 1;
    
    @track state = {
        promotionName: '',
        chosenProducts: [],
        chosenStores: []
    };

    @track isSaving = false;

    // Handle state updates from child components
    handleStateUpdate(event) {
        const { key, value } = event.detail;
        this.state = { ...this.state, [key]: value };
    }

    handleNext() {
        if (this.currentStep === 1) {
            const element = this.template.querySelector('c-promotion-wizard-step1');
            if (element.allValid()) {
                this.currentStep++;
            } else {
                this.showToast('Validation Error', 'Please enter a promotion name.', 'error');
            }
        } else if (this.currentStep === 2) {
            const element = this.template.querySelector('c-promotion-wizard-step2');
            if (element.allValid()) {
                this.currentStep++;
            } else {
                this.showToast('Validation Error', 'Please select at least one product with a valid discount.', 'error');
            }
        }
    }

    handlePrevious() {
        this.currentStep--;
    }

    async handleSave() {
        const step3Element = this.template.querySelector('c-promotion-wizard-step3');
        
        if (!step3Element || !step3Element.allValid()) {
            this.showToast('Validation Error', 'Please select at least one store.', 'error');
            return;
        }

        // Get final promotion data from step 3
        const promotionData = step3Element.getPromotionData();
        
        // Build the payload for Apex
        const payload = {
            promotionName: this.state.promotionName,
            accountId: this.recordId,
            templateId: null,
            startDate: null,
            endDate: null,
            products: this.state.chosenProducts.map(p => ({
                productId: p.productId,
                productName: p.productName,
                category: p.category || null,
                discountPercent: p.discountPercent
            })),
            stores: this.state.chosenStores.map(s => ({
                storeId: s.storeId,
                storeName: s.storeName,
                locationGroup: s.locationGroup || null
            }))
        };

        this.isSaving = true;

        try {
            const result = await savePromotion({ 
                promotionDataJson: JSON.stringify(payload) 
            });
            
            console.log('Save result:', result);
            
            this.showToast(
                'Success', 
                result.message || 'Promotion created successfully!', 
                'success'
            );
            
            // Close the modal/action
            this.closeAction();
            
            // Navigate to the new promotion record
            if (result.promotionId) {
                this.navigateToRecord(result.promotionId);
            }
            
        } catch (error) {
            const errorMessage = error.body?.message || error.message || 'An unexpected error occurred.';
            this.showToast('Error', errorMessage, 'error');
        } finally {
            this.isSaving = false;
        }
    }

    closeAction() {
        this.dispatchEvent(new CloseActionScreenEvent());
        this.dispatchEvent(new CustomEvent('close'));
    }

    navigateToRecord(recordId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                objectApiName: 'Promotion',
                actionName: 'view'
            }
        });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }

    get isStep1() {
        return this.currentStep === 1;
    }

    get isStep2() {
        return this.currentStep === 2;
    }

    get isStep3() {
        return this.currentStep === 3;
    }

    get stepTitle() {
        switch(this.currentStep) {
            case 1: return 'Step 1: Promotion Details';
            case 2: return 'Step 2: Select Products';
            case 3: return 'Step 3: Select Stores';
            default: return 'Create Promotion';
        }
    }

    get saveButtonLabel() {
        return this.isSaving ? 'Creating...' : 'Create Promotion';
    }

    get isSaveDisabled() {
        return this.isSaving;
    }

    get showPrevious() {
        return this.currentStep !== 1;
    }

    get showNext() {
        return this.currentStep !== 3;
    }

    get showFinish() {
        return this.currentStep === 3;
    }

    get currentStepForProgress() {
        return `${this.currentStep}`;
    }
}