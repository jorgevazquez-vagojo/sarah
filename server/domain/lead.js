/**
 * Lead Domain Model
 * Encapsulates lead business logic
 */

class Lead {
  constructor(id, tenantId, name, email, businessLine) {
    this.id = id;
    this.tenantId = tenantId;
    this.name = name;
    this.email = email;
    this.businessLine = businessLine;
    this.phone = null;
    this.company = null;
    this.createdAt = new Date();
    this.score = 0;
    this.status = 'new'; // new, contacted, qualified, converted, lost
    this.source = 'sarah'; // sarah, website, email, etc
  }

  contact() {
    this.status = 'contacted';
  }

  qualify() {
    this.status = 'qualified';
  }

  convert() {
    this.status = 'converted';
  }

  lose() {
    this.status = 'lost';
  }

  addScore(points) {
    this.score += points;
    this.score = Math.min(100, this.score); // Cap at 100
  }

  isQualified() {
    return this.score >= 60;
  }

  canBeContacted() {
    return this.status === 'new' || this.status === 'qualified';
  }
}

module.exports = Lead;
