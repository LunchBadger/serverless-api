const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const k8s = require('@kubernetes/client-node');

const k8sApi = k8s.Config.defaultClient();
const ext = new k8s.Custom_objectsApi(k8sApi.basePath);
ext.authentications.default = k8sApi.authentications.default;
module.exports = {
  ensureConfig () {
    if (!fs.existsSync(path.join(process.env.HOME, '/.kube/config'))) {
            // then we are running in container as root
      fs.mkdirSync('/root/.kube');
      const tmpl = yaml.safeLoad(fs.readFileSync(path.join(__dirname, 'kube-config.template.json')));

            // This is localtion of credentials for service account running pod (default if not set)
      const ca = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
      const token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token');

      tmpl.clusters[0].cluster['certificate-authority-data'] = ca;
      tmpl.users[0].user.token = token;
      fs.writeFileSync('/root/.kube/config', yaml.dump(tmpl));
    }
  },

  async listAllDeployedFunctions () {
    return ext.listNamespacedCustomObject('kubeless.io', 'v1beta1', 'customer', 'functions').then(x => x.body.items);
  },

  async deleteFunction ({name}) {
    return ext.deleteNamespacedCustomObject('kubeless.io', 'v1beta1', 'customer', 'functions', name);
  }
};
