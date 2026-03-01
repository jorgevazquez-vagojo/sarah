# Business Unit Routing Configuration

## Overview
Sarah routes incoming conversations to appropriate Business Units (BU) based on:
1. Customer inquiry type
2. BU assignment in widget config
3. Agent skill matching

## Business Units

### 1. Boostic (SEO & Growth)
- **Extensions**: 101, 102, 103
- **Default**: 101
- **Queue**: boostic-queue
- **Skills**: seo, growth, analytics
- **Email**: boostic@redegal.com

### 2. Binnacle (Business Intelligence)
- **Extensions**: 104, 105
- **Default**: 104
- **Queue**: binnacle-queue
- **Skills**: analytics, reporting, dashboards
- **Email**: binnacle@redegal.com

### 3. Digital Marketing
- **Extensions**: 106, 107
- **Default**: 106
- **Queue**: marketing-queue
- **Skills**: digital-marketing, campaigns
- **Email**: marketing@redegal.com

### 4. Technical Development
- **Extensions**: 108, 109, 110
- **Default**: 108
- **Queue**: tech-queue
- **Skills**: development, infrastructure, devops
- **Email**: tech@redegal.com

## Configuration

### Edit Business Units
File: `server/config/business-units.yaml`

```yaml
business_units:
  boostic:
    display_name: "Boostic - SEO & Growth"
    extensions: [101, 102, 103]
    default_extension: 101
    pbx_queue: "boostic-queue"
    email: "boostic@redegal.com"
```

### Update Extension
```bash
curl -X PUT http://localhost:3000/api/business-units/boostic/extensions \
  -H "Content-Type: application/json" \
  -d '{"extension": 102}'
```

### Get BU Info
```bash
curl http://localhost:3000/api/business-units/boostic
```

## Routing Logic

### Intent-Based Routing
```javascript
// Router detects intent from message and routes accordingly
"Quiero mejorar mi SEO" → Boostic (101)
"¿Cómo mido mi BI?" → Binnacle (104)
"Campaña de marketing" → Marketing (106)
"Bug en mi API" → Tech (108)
```

### Skill-Based Routing
```javascript
// Agent must have matching skill
Agent skills: ['seo', 'analytics']
Conversation skill: 'seo'
→ Route to agent with 'seo' skill
```

### Round-Robin
```javascript
// If multiple agents available, rotate
Boostic agents: [Agent1, Agent2, Agent3]
Last served: Agent2
→ Route to Agent3
→ Next: Agent1
```

## SIP/Vozelia Integration

### Click2Call Outbound
```javascript
// Use Tech extension (108) for outbound calls
extension: 108,
domain: cloudpbx1584.vozelia.com,
username: tech_pbx_user,
password: secure_password
```

### Inbound Routing
```javascript
// Incoming call on extension 101 (Boostic)
→ Rings all Boostic agents
→ First to accept takes call
→ If no answer, goes to queue/voicemail
```

## Testing

### Test Routing
```bash
npm run test -- bu-router
```

### Simulate Call
```javascript
const buRouter = require('./services/bu-router');
const routing = await buRouter.routeConversation({
  id: 'conv-123',
  business_line: 'boostic'
});
console.log(routing);
// {
//   extension: 101,
//   queue: "boostic-queue",
//   displayName: "Boostic - SEO & Growth",
//   skills: ["seo", "growth"]
// }
```

## Monitoring

### View Extension Status
```bash
curl http://localhost:3000/api/business-units/boostic/extensions
```

### Check Active Calls
```javascript
// Implemented in PBX integration
const calls = await pbx.getActiveCalls('boostic-queue');
```

## Troubleshooting

### Call Not Routing
1. Check BU config: `server/config/business-units.yaml`
2. Verify extension exists in Vozelia
3. Check if agents are available
4. Review logs: `curl http://localhost:3000/health`

### Extension Not Ringing
1. Check PBX connection
2. Verify extension credentials
3. Check firewall (port 5060 SIP)
4. Review Vozelia dashboard

---
Last Updated: 2026-02-24
