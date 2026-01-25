import { LightningElement, api } from 'lwc';

export default class PromotionWizardStep1 extends LightningElement {
    
    @api promotionName;

    handleChange(event) {
        this.promotionName = event.detail.value;
    }

    @api
    allValid(){
        if(this.promotionName === undefined || this.promotionName === ''){
            return false;
        }
        
        // Dispatch event to update state in parent
        this.dispatchEvent(new CustomEvent('stateupdate', {
            detail: { key: 'promotionName', value: this.promotionName },
            bubbles: true,
            composed: true
        }));
        
        return true;
    }
}